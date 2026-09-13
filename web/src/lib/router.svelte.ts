export type RouteName = 'contacts' | 'contact-detail' | 'templates' | 'jobs';

class Router {
  path = $state<string>('/contacts');
  params = $state<Record<string, string>>({});

  constructor() {
    if (typeof window !== 'undefined') {
      this.updateFromLocation();
      window.addEventListener('popstate', () => {
        this.updateFromLocation();
      });

      document.addEventListener('click', (e: MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a');
        if (!target) return;
        const href = target.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//') && !target.hasAttribute('download') && target.getAttribute('target') !== '_blank') {
          e.preventDefault();
          this.navigate(href);
        }
      });
    }
  }

  navigate(url: string) {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', url);
      this.updateFromLocation();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  private updateFromLocation() {
    const rawPath = window.location.pathname;
    const normalized = rawPath === '/' ? '/contacts' : rawPath;
    this.path = normalized;

    const contactMatch = normalized.match(/^\/contacts\/([^/]+)$/);
    if (contactMatch) {
      this.params = { contactId: contactMatch[1] };
    } else {
      this.params = {};
    }
  }

  get route(): RouteName {
    if (this.path === '/templates') return 'templates';
    if (this.path === '/jobs') return 'jobs';
    if (this.path.startsWith('/contacts/')) return 'contact-detail';
    return 'contacts';
  }
}

export const router = new Router();
