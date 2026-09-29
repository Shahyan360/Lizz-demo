"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type EditorProps = { value: string; onChange: (html: string) => void };

/**
 * Rich-text email editor (CKEditor). Loaded with `ssr: false` because the
 * CKEditor build accesses browser globals and must not run during SSR.
 * `value`/`onChange` deal in HTML strings.
 */
const load = () =>
  // NodeNext wants a file extension here; Next's bundler resolves the .tsx fine.
  // @ts-expect-error -- extensionless dynamic import is intentional.
  import("./CKEditorInner");

const CKEditorInner = dynamic(load, {
  ssr: false,
  loading: () => (
    <div
      style={{
        padding: "0.9rem",
        color: "#98a2b3",
        fontSize: "0.85rem",
        border: "1px solid #e4e7ec",
        borderRadius: 8,
      }}
    >
      Loading editor…
    </div>
  ),
}) as ComponentType<EditorProps>;

export function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  return (
    <div className="rich-editor">
      <CKEditorInner value={value} onChange={onChange} />
    </div>
  );
}
