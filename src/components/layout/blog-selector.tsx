"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useBlog } from "@/lib/blog-context";
import type { Blog } from "@/lib/blog-context";

const ICON_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-pink-500",
];

function getBlogColor(blogs: Blog[], blog: Blog): string {
  const index = blogs.findIndex((b) => b.id === blog.id);
  return ICON_COLORS[(index < 0 ? 0 : index) % ICON_COLORS.length];
}

function BlogIcon({ blog, blogs }: { blog: Blog; blogs: Blog[] }) {
  const colorClass = getBlogColor(blogs, blog);
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${colorClass}`}
    >
      {blog.name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

export function BlogSelector() {
  const { blogs, selectedBlog, setSelectedBlog } = useBlog();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ height: 44 }}
        className="flex w-full items-center gap-2.5 px-4 text-left transition-colors hover:bg-[var(--surface-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      >
        {selectedBlog ? (
          <>
            <BlogIcon blog={selectedBlog} blogs={blogs} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
              {selectedBlog.name}
            </span>
          </>
        ) : (
          <>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-sunken)] text-[var(--text-tertiary)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
              No blogs yet
            </span>
          </>
        )}
        {/* Chevron down */}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] shadow-sm"
        >
          {blogs.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
              No blogs yet
            </div>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1">
              {blogs.map((blog) => {
                const isSelected = selectedBlog?.id === blog.id;
                return (
                  <li key={blog.id}>
                    <button
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedBlog(blog);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${
                        isSelected
                          ? "bg-[var(--accent-light)] text-[var(--accent)]"
                          : "text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]"
                      }`}
                    >
                      <BlogIcon blog={blog} blogs={blogs} />
                      <span className="min-w-0 flex-1 truncate font-medium">{blog.name}</span>
                      {isSelected && (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Divider + Add Blog */}
          <div className="border-t border-[var(--border-default)]">
            <Link
              href="/app/integrations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Add Blog</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
