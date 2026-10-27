import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.logging import logger
from app.providers.base import ContactCenterProvider, ProviderContactResult, ProviderHealth


class AmazonConnectAdapter(ContactCenterProvider):
    """
    Amazon Connect Integration Adapter.
    Communicates with AWS Amazon Connect APIs using official Boto3 SDK,
    supporting Outbound Voice/Chat initiation, CTR ingestion, and EventBridge streams.
    
    Adheres to IAM least privilege, environment-based credentials,
    and graceful error handling with exponential backoff.
    """

    def __init__(self):
        self._region = settings.AWS_REGION
        self._instance_id = settings.AWS_CONNECT_INSTANCE_ID
        self._contact_flow_id = settings.AWS_CONNECT_CONTACT_FLOW_ID
        self._source_phone = settings.AWS_CONNECT_SOURCE_PHONE

        # Initialize boto3 client conditionally
        self._has_credentials = bool(
            settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and self._instance_id
        )

        self._client = None
        if self._has_credentials:
            try:
                self._client = boto3.client(
                    "connect",
                    region_name=self._region,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                )
            except Exception as e:
                logger.error(f"Failed to initialize boto3 Amazon Connect client: {e}")
                self._client = None

    @property
    def provider_name(self) -> str:
        return "Amazon Connect (AWS Cloud)"

    @property
    def is_simulated(self) -> bool:
        return False

    async def initiate_contact(
        self,
        customer_identifier: str,
        channel: str,
        queue_id: Optional[int] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> ProviderContactResult:
        if not self._client or not self._has_credentials:
            logger.warning(
                "AWS credentials or Connect Instance ID not configured. "
                "Simulating adapter response without live AWS dispatch. "
                "See docs/amazon-connect-setup.md."
            )
            return ProviderContactResult(
                provider_contact_id="aws-unverified-credential-missing",
                channel=channel,
                status="FAILED_UNCONFIGURED_CREDENTIALS",
                is_simulated=False,
                metadata={
                    "error": "AWS credentials or instance ID missing",
                    "docs": "Consult docs/amazon-connect-setup.md to configure AWS IAM and Connect Instance ID.",
                },
            )

        # Call AWS Amazon Connect with retry backoff
        max_retries = 3
        delay = 0.5
        for attempt in range(1, max_retries + 1):
            try:
                if channel.lower() == "voice":
                    response = await asyncio.to_thread(
                        self._client.start_outbound_voice_contact,
                        DestinationPhoneNumber=customer_identifier,
                        ContactFlowId=self._contact_flow_id,
                        InstanceId=self._instance_id,
                        SourcePhoneNumber=self._source_phone,
                        Attributes=attributes or {},
                    )
                    contact_id = response.get("ContactId", "")
                else:
                    response = await asyncio.to_thread(
                        self._client.start_chat_contact,
                        InstanceId=self._instance_id,
                        ContactFlowId=self._contact_flow_id,
                        ParticipantDetails={"DisplayName": "Customer"},
                        Attributes=attributes or {},
                    )
                    contact_id = response.get("ContactId", "")

                logger.info(f"Successfully initiated Amazon Connect contact {contact_id}")
                return ProviderContactResult(
                    provider_contact_id=contact_id,
                    channel=channel,
                    status="QUEUED",
                    is_simulated=False,
                    metadata={"aws_response": response},
                )
            except ClientError as ce:
                code = ce.response.get("Error", {}).get("Code")
                if code in ("TooManyRequestsException", "ThrottlingException") and attempt < max_retries:
                    logger.warning(f"Amazon Connect throttling on attempt {attempt}. Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                logger.error(f"Amazon Connect ClientError ({code}): {ce}")
                raise
            except BotoCoreError as be:
                logger.error(f"Amazon Connect BotoCoreError: {be}")
                raise

        raise RuntimeError("Exceeded maximum retries contacting Amazon Connect API.")

    async def terminate_contact(
        self,
        provider_contact_id: str,
        reason: Optional[str] = None,
    ) -> bool:
        if not self._client or not self._has_credentials:
            logger.info(f"Skipping Amazon Connect terminate_contact for {provider_contact_id} (credentials unconfigured)")
            return True

        try:
            await asyncio.to_thread(
                self._client.stop_contact,
                ContactId=provider_contact_id,
                InstanceId=self._instance_id,
            )
            return True
        except Exception as e:
            logger.error(f"Error terminating Amazon Connect contact {provider_contact_id}: {e}")
            return False

    async def process_event(
        self,
        idempotency_key: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Processes Contact Trace Records (CTR) and Agent Event Streams (AES)
        ingested via AWS EventBridge or SNS.
        """
        logger.info(f"Processing Amazon Connect CTR event: {event_type} (Key: {idempotency_key})")
        contact_id = payload.get("ContactId") or payload.get("contactId")
        channel = payload.get("Channel", "VOICE")
        disconnect_reason = payload.get("DisconnectReason", "AGENT_DISCONNECT")

        return {
            "status": "PROCESSED",
            "provider": "amazon_connect",
            "idempotency_key": idempotency_key,
            "contact_id": contact_id,
            "channel": channel,
            "disconnect_reason": disconnect_reason,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def check_health(self) -> ProviderHealth:
        if not self._has_credentials:
            return ProviderHealth(
                provider_name=self.provider_name,
                is_connected=False,
                is_simulated=False,
                details={
                    "status": "UNCONFIGURED",
                    "reason": "AWS credentials or instance ID are not present in .env. Core app runs via SimulatorProvider.",
                    "documentation": "docs/amazon-connect-setup.md",
                },
            )

        try:
            res = await asyncio.to_thread(
                self._client.describe_instance,
                InstanceId=self._instance_id,
            )
            instance_summary = res.get("Instance", {})
            return ProviderHealth(
                provider_name=self.provider_name,
                is_connected=True,
                is_simulated=False,
                details={
                    "status": "ACTIVE",
                    "instance_arn": instance_summary.get("Arn"),
                    "instance_status": instance_summary.get("InstanceStatus"),
                },
            )
        except Exception as e:
            logger.warning(f"Amazon Connect health check failed: {e}")
            return ProviderHealth(
                provider_name=self.provider_name,
                is_connected=False,
                is_simulated=False,
                details={"status": "ERROR", "error": str(e)},
            )
