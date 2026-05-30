import "katex/dist/katex.min.css";

import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "~/lib/utils";

export function StudyMarkdown({
  content,
  className,
}: {
  readonly content: string;
  readonly className?: string;
}) {
  if (content.trim().length === 0) return null;

  return (
    <div className={cn("study-markdown min-w-0 text-sm leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
