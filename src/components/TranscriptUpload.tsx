import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Upload, FileText, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptUploadProps {
  open: boolean;
  onClose: () => void;
  onCoursesExtracted: (courses: any[]) => void;
}

// Mock courses that simulate extraction from degree audit
// These match PMU Computer Science curriculum
const MOCK_EXTRACTED_COURSES = [
  { id: 'COMM1311', code: 'COMM 1311', name: 'Written Communication', credits: 3 },
  { id: 'MATH1422', code: 'MATH 1422', name: 'Calculus I', credits: 4 },
  { id: 'ALIS1211', code: 'ALIS 1211', name: 'Introduction to Islamic Culture', credits: 2 },
  { id: 'PHYS1421', code: 'PHYS 1421', name: 'Physics for Engineers I', credits: 4 },
  { id: 'COMM1312', code: 'COMM 1312', name: 'Writing and Research', credits: 3 },
  { id: 'MATH1423', code: 'MATH 1423', name: 'Calculus II', credits: 4 },
  { id: 'UNIV1211', code: 'UNIV 1211', name: 'Professional Development and Competencies', credits: 2 },
  { id: 'PHED1111', code: 'PHED 1111', name: 'Active Living Lifestyle', credits: 1 },
];

export function TranscriptUpload({ open, onClose, onCoursesExtracted }: TranscriptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Please upload a PDF or image file (JPG, PNG)');
        return;
      }
      
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleProcess = () => {
    if (!file) {
      toast.error('Please upload a file first');
      return;
    }

    setProcessing(true);
    
    // Simulate processing with delay
    setTimeout(() => {
      // In a real implementation, this would:
      // 1. Send file to backend API
      // 2. Use OCR + NLP to extract course information
      // 3. Parse degree audit structure and identify courses
      // 4. Return structured course data
      
      // Automatically apply extracted courses
      onCoursesExtracted(MOCK_EXTRACTED_COURSES);
      toast.success(`${MOCK_EXTRACTED_COURSES.length} course(s) extracted and added`);
      
      // Reset and close
      handleReset();
      onClose();
    }, 2500);
  };

  const handleReset = () => {
    setFile(null);
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Upload Degree Audit
          </DialogTitle>
          <DialogDescription>
            Upload your degree audit (PDF or image) and we'll add your completed courses automatically.
            <br />
            <span className="text-amber-600 mt-1 block">
              ⚠️ Prototype Mode: This simulates extraction with sample data
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-full max-w-md">
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {file ? (
                        <>
                          <FileText className="w-10 h-10 mb-2 text-blue-600" />
                          <p className="text-sm text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">Click to upload degree audit</p>
                          <p className="text-xs text-gray-500">PDF, JPG, or PNG (max 10MB)</p>
                        </>
                      )}
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  {file && (
                    <>
                      <Button onClick={handleProcess} disabled={processing}>
                        {processing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Extract Courses
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={handleReset} disabled={processing}>
                        Reset
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
