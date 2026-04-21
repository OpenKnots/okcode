import { useCallback, useRef, type ChangeEvent } from "react";

import { readFileAsDataUrl } from "~/lib/fileData";

export function useProjectIconFilePicker(options: {
  onFileSelected: (dataUrl: string) => void;
  onError?: (error: unknown) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { onFileSelected, onError } = options;

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
        onError?.(error);
      }
    },
    [onFileSelected, onError],
  );

  return {
    fileInputRef,
    openFilePicker,
    handleFileChange,
  };
}
