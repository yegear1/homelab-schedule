export interface ToastState {
  visible: boolean;
  message: string;
  icon: string;
  isError: boolean;
  colorClass: string;
}

class ToastService {
  state = $state<ToastState>({
    visible: false,
    message: '',
    icon: 'info',
    isError: false,
    colorClass: 'text-primary'
  });

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  show(message: string, icon = 'info', isError = false, colorClass = 'text-primary') {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.state.message = message;
    this.state.icon = icon;
    this.state.isError = isError;
    this.state.colorClass = isError ? 'text-error' : colorClass;
    this.state.visible = true;

    this.timeoutId = setTimeout(() => {
      this.state.visible = false;
    }, 4200);
  }

  success(message: string) {
    this.show(message, 'check_circle', false, 'text-tertiary');
  }

  error(message: string) {
    this.show(message, 'warning', true, 'text-error');
  }

  info(message: string) {
    this.show(message, 'info', false, 'text-primary');
  }

  queued(message: string) {
    this.show(message, 'bolt', false, 'text-primary');
  }
}

export const toast = new ToastService();
