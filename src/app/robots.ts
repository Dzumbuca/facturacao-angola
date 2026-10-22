import type { MetadataRoute } from 'next';

const BASE_URL = 'https://facturacao-angola.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/login', '/register', '/onboarding'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
