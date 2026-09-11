class AppError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class EntityNotFound(AppError):
    pass


class Unauthorized(AppError):
    pass


class YamlJobImmutable(AppError):
    pass


class DispatchNotReady(AppError):
    pass
