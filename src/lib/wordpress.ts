export interface WpBlogConfig {
  id: string;
  url: string;
  username: string;
  appPassword: string;
}

export interface WordPressUserSettings {
  wp_url?: string | null;
  wp_username?: string | null;
  wp_app_password?: string | null;
  wp_blogs?: WpBlogConfig[] | null;
}

export function getBlogCredentials(
  settings: WordPressUserSettings,
  blogId?: string
): { wpUrl: string; auth: string } | null {
  const blogs = settings.wp_blogs;

  if (blogs && Array.isArray(blogs) && blogs.length > 0) {
    const blog = blogId ? blogs.find((b) => b.id === blogId) : blogs[0];
    if (blog?.url && blog?.username && blog?.appPassword) {
      return {
        wpUrl: blog.url.replace(/\/$/, ""),
        auth: Buffer.from(`${blog.username}:${blog.appPassword}`).toString("base64"),
      };
    }
  }

  if (settings.wp_url && settings.wp_username && settings.wp_app_password) {
    return {
      wpUrl: settings.wp_url.replace(/\/$/, ""),
      auth: Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString("base64"),
    };
  }

  return null;
}
