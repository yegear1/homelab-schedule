from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    schedule_api_key: str
    database_path: str = "./data/schedule.sqlite"
    env: str = "development"
    service_name: str = "homelab-schedule"
    tz: str = "America/Sao_Paulo"
    app_port: int = 8002
