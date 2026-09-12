from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    schedule_api_key: str
    database_path: str = "./data/schedule.sqlite"
    env: str = "development"
    service_name: str = "homelab-schedule"
    app: str = "homelab-schedule"
    log_format: str = "json"
    tz: str = "America/Sao_Paulo"
    app_port: int = 8003
    whatsapp_api_url: str = "http://localhost:8001"
    whatsapp_api_key: str = ""
    whatsapp_aliases: str = "eu=5511999998888@c.us"
    routines_path: str = "./routines.yaml"
    job_retention_days: int = 365
