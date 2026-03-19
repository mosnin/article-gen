"use client";

import { CopyButton } from "./CopyButton";
import type { ImagePrompt, GeneratedImage } from "../types";

export function ImagePromptCard({
  image,
  generatedImage,
}: {
  image: ImagePrompt;
  generatedImage?: GeneratedImage;
}) {
  return (
    <div
      className="rounded-xl border"
      style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          {image.type}
        </h3>
      </div>
      {generatedImage?.publicUrl && (
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--card-border)" }}>
          <img
            src={generatedImage.publicUrl}
            alt={image.altText}
            className="w-full rounded-lg"
            style={{ aspectRatio: "1536/1024", objectFit: "cover" }}
          />
        </div>
      )}
      <div className="space-y-3 px-5 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Prompt
            </span>
            <CopyButton text={image.prompt} label="Copy Prompt" />
          </div>
          <p
            className="rounded-lg p-3 text-sm leading-relaxed"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          >
            {image.prompt}
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Alt Text
            </span>
            <CopyButton text={image.altText} label="Copy Alt Text" />
          </div>
          <p
            className="rounded-lg p-3 text-sm leading-relaxed"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          >
            {image.altText}
          </p>
        </div>
      </div>
    </div>
  );
}
