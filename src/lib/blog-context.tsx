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
  setSelectedBlog: (blog: Blog | null) => void;
  setBlogs: (blogs: Blog[]) => void;
}

export const BlogContext = createContext<BlogContextValue>({
  blogs: [],
  selectedBlog: null,
  setSelectedBlog: () => {},
  setBlogs: () => {},
});

export function useBlog() {
  return useContext(BlogContext);
}

const STORAGE_KEY = "article-gen:selectedBlogId";

export function BlogProvider({
  children,
  initialBlogs = [],
}: {
  children: React.ReactNode;
  initialBlogs?: Blog[];
}) {
  const [blogs, setBlogs] = useState<Blog[]>(initialBlogs);
  const [selectedBlog, setSelectedBlogState] = useState<Blog | null>(null);

  // On mount: restore from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId && initialBlogs.length > 0) {
      const found = initialBlogs.find((b) => b.id === storedId);
      setSelectedBlogState(found ?? initialBlogs[0] ?? null);
    } else if (initialBlogs.length > 0) {
      setSelectedBlogState(initialBlogs[0]);
    }
  }, [initialBlogs]);

  // When blogs list changes externally, sync selection
  useEffect(() => {
    setBlogs(initialBlogs);
    if (initialBlogs.length > 0 && !selectedBlog) {
      const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const found = storedId ? initialBlogs.find((b) => b.id === storedId) : null;
      setSelectedBlogState(found ?? initialBlogs[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialBlogs)]);

  const setSelectedBlog = useCallback((blog: Blog | null) => {
    setSelectedBlogState(blog);
    if (typeof window !== "undefined") {
      if (blog) {
        localStorage.setItem(STORAGE_KEY, blog.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return (
    <BlogContext.Provider value={{ blogs, selectedBlog, setSelectedBlog, setBlogs }}>
      {children}
    </BlogContext.Provider>
  );
}
