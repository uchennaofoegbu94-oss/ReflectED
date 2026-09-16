import { useEffect } from 'react';
import { useSchool } from '@/contexts/SchoolContext';

/**
 * Phase 8 — Full Branding Audit.
 * Reflects the tenant school's identity in the browser chrome:
 *  - Document title becomes "{School Name} • ReflectED"
 *  - Favicon swaps to the school logo when one is uploaded
 *  - apple-mobile-web-app-title mirrors the school name for installed PWAs
 *
 * When no tenant is loaded (e.g. landing page, super admin) the platform
 * defaults from index.html remain untouched.
 */
export function useTenantBranding() {
  const { school } = useSchool();

  useEffect(() => {
    if (!school?.name) return;

    const previousTitle = document.title;
    document.title = `${school.name} • ReflectED`;

    const appleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    const previousAppleTitle = appleTitle?.content;
    if (appleTitle) appleTitle.content = school.name;

    let faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const previousFavicon = faviconEl?.href;
    if (school.logo_url) {
      if (!faviconEl) {
        faviconEl = document.createElement('link');
        faviconEl.rel = 'icon';
        document.head.appendChild(faviconEl);
      }
      faviconEl.href = school.logo_url;
    }

    return () => {
      document.title = previousTitle;
      if (appleTitle && previousAppleTitle !== undefined) {
        appleTitle.content = previousAppleTitle;
      }
      if (faviconEl && previousFavicon !== undefined) {
        faviconEl.href = previousFavicon;
      }
    };
  }, [school?.name, school?.logo_url]);
}
