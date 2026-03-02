"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";

interface BlockNoteEditorProps {
  initialContent?: PartialBlock[];
  onChange?: (blocks: PartialBlock[]) => void;
  editable?: boolean;
}

export default function BlockNoteEditor({
  initialContent,
  onChange,
  editable = true,
}: BlockNoteEditorProps) {
  const editor = useCreateBlockNote({
    codeBlock: codeBlockOptions,
    initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
  });

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme="dark"
      onChange={() => {
        onChange?.(editor.document as PartialBlock[]);
      }}
    />
  );
}
