class AppError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class EntityNotFound(AppError):
    pass


class Unauthorized(AppError):
    pass


class YamlIdConflict(AppError):
    pass


class Conflict(AppError):
    pass


class YamlJobImmutable(Conflict):
    pass


class GatekeeperError(AppError):
    pass
