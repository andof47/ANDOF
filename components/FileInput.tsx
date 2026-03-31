
import React, { useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileInputProps {
  onFileSelect: (file: File) => void;
  onError: (message: string) => void;
  disabled: boolean;
}

export const FileInput: React.FC<FileInputProps> = ({ onFileSelect, onError, disabled }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['txt', 'pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      onError('Unsupported file type. Please upload a .txt, .pdf, .docx, or image file.');
      // Reset the input so the user can select the same file again if they made a mistake
      event.target.value = '';
      return;
    }

    onFileSelect(file);
    event.target.value = ''; 
  }, [onFileSelect, onError]);

  return (
    <div>
      <label htmlFor="file-upload" className={`relative cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 ${disabled ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'}`}>
        <UploadIcon />
        <span>Upload File</span>
      </label>
      <input
        id="file-upload"
        name="file-upload"
        type="file"
        className="sr-only"
        onChange={handleFileChange}
        accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
        disabled={disabled}
      />
    </div>
  );
};
