"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface Blog {
  id: string;
  name: string;
  url: string;
  username?: string;
  appPassword?: string;
  authorName?: string;
  authorAbout?: string;
}

interface BlogContextValue {
  blogs: Blog[];
  selectedBlog: Blog | null;
  setBlogs: (blogs: Blog[]) => void;
  setSelectedBlog: (blog: Blog | null) => void;
}

export const BlogContext = createContext<BlogContextValue>({
  blogs: [],
  selectedBlog: null,
  setBlogs: () => {},
  setSelectedBlog: () => {},
});

export function useBlog() {
  return useContext(BlogContext);
}

interface BlogProviderProps {
  children: React.ReactNode;
  initialBlogs?: Blog[];
}

export function BlogProvider({ children, initialBlogs = [] }: BlogProviderProps) {
  const [blogs, setBlogs] = useState<Blog[]>(initialBlogs);
  const [selectedBlog, setSelectedBlogState] = useState<Blog | null>(null);

  // Hydrate blogs when initialBlogs changes (layout fetches them async)
  useEffect(() => {
    if (initialBlogs.length > 0) {
      setBlogs(initialBlogs);
    }
  }, [initialBlogs]);

  // Restore selected blog from localStorage
  useEffect(() => {
    if (blogs.length === 0) return;
    const savedId = typeof window !== "undefined"
      ? localStorage.getItem("selectedBlogId")
      : null;
    if (savedId) {
      const found = blogs.find((b) => b.id === savedId);
      if (found) {
        setSelectedBlogState(found);
        return;
      }
    }
    // Default to first blog
    setSelectedBlogState(blogs[0]);
  }, [blogs]);

  const setSelectedBlog = useCallback((blog: Blog | null) => {
    setSelectedBlogState(blog);
    if (typeof window !== "undefined") {
      if (blog) {
        localStorage.setItem("selectedBlogId", blog.id);
      } else {
        localStorage.removeItem("selectedBlogId");
      }
    }
  }, []);

  return (
    <BlogContext.Provider value={{ blogs, selectedBlog, setBlogs, setSelectedBlog }}>
      {children}
    </BlogContext.Provider>
  );
}
