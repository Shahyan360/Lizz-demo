"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";

/** The actual CKEditor. Loaded client-only (the build touches `window`). */
export default function CKEditorInner({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  return (
    <CKEditor
      editor={ClassicEditor}
      data={value}
      onChange={(_event: unknown, editor: ClassicEditor) =>
        onChange(editor.getData())
      }
      config={{
        toolbar: [
          "heading",
          "|",
          "bold",
          "italic",
          "link",
          "bulletedList",
          "numberedList",
          "|",
          "outdent",
          "indent",
          "|",
          "blockQuote",
          "undo",
          "redo",
        ],
      }}
    />
  );
}
