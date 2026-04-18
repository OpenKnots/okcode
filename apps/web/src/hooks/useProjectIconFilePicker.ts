import { useCallback, useRef, type ChangeEvent } from "react";

import { readFileAsDataUrl } from "~/lib/fileData";

export function useProjectIconFilePicker(options: { onFileSelected: (dataUrl: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { onFileSelected } = options;

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) {
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        onFileSelected(dataUrl);
      } catch (error) {
        console.error("Failed to read project icon image:", error);
      }
    },
    [onFileSelected],
  );

  return {
    fileInputRef,
    openFilePicker,
    handleFileChange,
  };
}
