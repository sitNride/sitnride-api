import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database as supabase } from '@/lib/database';
import {
  UploadIcon,
  CameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  FileTextIcon,
  ShieldIcon,
  CarIcon,
  AlertTriangleIcon,
  ChevronLeftIcon,
} from '@/components/ui/Icons';

interface DocumentUpload {
  id: string;
  label: string;
  description: string;
  file: File | null;
  preview: string | null;
  status: 'idle' | 'uploading' | 'success' | 'error';
  uploadedUrl: string | null;
}

const initialDocuments: DocumentUpload[] = [
  {
    id: 'drivers_license',
    label: "Upload Driver's License",
    description: "A clear photo or scan of your valid driver's license (front and back).",
    file: null,
    preview: null,
    status: 'idle',
    uploadedUrl: null,
  },
  {
    id: 'proof_of_insurance',
    label: 'Upload Proof of Insurance',
    description: 'A copy of your current, active auto insurance policy or insurance card.',
    file: null,
    preview: null,
    status: 'idle',
    uploadedUrl: null,
  },
  {
    id: 'vehicle_inspection',
    label: 'Upload Vehicle Inspection',
    description: 'A copy of your completed vehicle inspection report or certificate.',
    file: null,
    preview: null,
    status: 'idle',
    uploadedUrl: null,
  },
  {
    id: 'dash_cam_proof',
    label: 'Upload Dash Cam Proof',
    description: 'Upload a receipt of purchase and/or a photo of your installed dash cam.',
    file: null,
    preview: null,
    status: 'idle',
    uploadedUrl: null,
  },
];

const documentIcons: Record<string, React.ReactNode> = {
  drivers_license: <FileTextIcon className="text-orange-600" size={28} />,
  proof_of_insurance: <ShieldIcon className="text-blue-600" size={28} />,
  vehicle_inspection: <CarIcon className="text-green-600" size={28} />,
  dash_cam_proof: <CameraIcon className="text-purple-600" size={28} />,
};

const UploadDocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentUpload[]>(initialDocuments);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Get user ID from Supabase session directly (no AuthContext dependency)
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        // Also check localStorage as fallback
        const storedUser = localStorage.getItem('rideshare_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            setUserId(parsed.id || null);
          } catch {
            setUserId(null);
          }
        }
      }
    };
    getUser();
  }, []);

  const allUploaded = documents.every((doc) => doc.status === 'success');

  const handleFileSelect = async (docId: string, file: File) => {
    // Update preview
    const previewUrl = URL.createObjectURL(file);
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? { ...doc, file, preview: previewUrl, status: 'uploading' }
          : doc
      )
    );

    // Upload to Supabase storage
    try {
      const fileExt = file.name.split('.').pop();
      const userFolder = userId || 'anonymous';
      const fileName = `${userFolder}/${docId}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId
            ? { ...doc, status: 'success', uploadedUrl: urlData.publicUrl }
            : doc
        )
      );
    } catch (error) {
      console.error('Upload error:', error);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId ? { ...doc, status: 'error' } : doc
        )
      );
    }
  };

  const handleRetry = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc?.file) {
      handleFileSelect(docId, doc.file);
    } else {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, status: 'idle', file: null, preview: null, uploadedUrl: null }
            : d
        )
      );
    }
  };

  const handleSubmit = async () => {
    if (!allUploaded) return;
    setSubmitting(true);

    try {
      // Save document references to the database if user is logged in
      if (userId) {
        const docRecords = documents.map((doc) => ({
          user_id: userId,
          document_type: doc.id,
          document_url: doc.uploadedUrl,
          status: 'pending_review',
          uploaded_at: new Date().toISOString(),
        }));

        // Try to insert into driver_documents table (non-blocking if table doesn't exist)
        try {
          await supabase.from('driver_documents').insert(docRecords);
        } catch {
          console.warn('driver_documents table may not exist — non-blocking');
        }
      }

      navigate('/documents-submitted');

    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-2xl font-bold text-gray-900">
              sit<span className="text-orange-600">N</span>ride
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="text-green-600" size={40} />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              Documents Submitted Successfully
            </h2>
            <p className="mt-3 text-gray-600 max-w-md mx-auto">
              Thank you for uploading your documents. Our team will review them
              and notify you once your account is fully approved.
            </p>

            <div className="mt-8 bg-gray-50 rounded-xl p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">
                What happens next?
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Document Review</p>
                    <p className="text-sm text-gray-600">
                      Our team will verify all uploaded documents.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Background Check</p>
                    <p className="text-sm text-gray-600">
                      A background check will be initiated (3-7 business days).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Approval Notification
                    </p>
                    <p className="text-sm text-gray-600">
                      You'll receive an email when your account is approved.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/')}
              className="mt-8 w-full py-4 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-gray-900">
            sit<span className="text-orange-600">N</span>ride
          </span>
          <p className="text-sm text-gray-500 mt-1">Driver Document Upload</p>
        </div>

        {/* Back to Home */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors mb-6 text-sm"
        >
          <ChevronLeftIcon size={16} />
          Back to Homepage
        </button>

        {/* Page Title */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
              <UploadIcon className="text-orange-600" size={32} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Upload Your Documents
            </h1>
            <p className="mt-2 text-gray-600">
              Please upload all required documents below to complete your driver
              setup.
            </p>
          </div>

          {/* Required Documents List */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangleIcon
                className="text-amber-600 flex-shrink-0 mt-0.5"
                size={20}
              />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Required Documents:</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Valid Driver's License</li>
                  <li>Proof of Insurance</li>
                  <li>Vehicle Inspection</li>
                  <li>
                    Dash Cam Proof (required — upload receipt of purchase and/or
                    photo of installed dash cam)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Sections */}
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl shadow-lg p-6 sm:p-8"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {documentIcons[doc.id]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {doc.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {doc.description}
                  </p>
                </div>
              </div>

              {/* Upload Area */}
              <input
                ref={(el) => {
                  fileInputRefs.current[doc.id] = el;
                }}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(doc.id, file);
                }}
              />

              {doc.status === 'idle' && (
                <div
                  onClick={() => fileInputRefs.current[doc.id]?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all"
                >
                  <UploadIcon className="text-gray-400 mx-auto" size={32} />
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    Upload a file or take a photo
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Supports images and PDF files
                  </p>
                </div>
              )}

              {doc.status === 'uploading' && (
                <div className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-8 text-center">
                  {doc.preview && (
                    <img
                      src={doc.preview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg mx-auto mb-3"
                    />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-orange-600 font-medium">
                      Uploading...
                    </span>
                  </div>
                </div>
              )}

              {doc.status === 'success' && (
                <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    {doc.preview && (
                      <img
                        src={doc.preview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon
                          className="text-green-600"
                          size={20}
                        />
                        <span className="text-sm font-medium text-green-700">
                          Document uploaded successfully
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {doc.file?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDocuments((prev) =>
                          prev.map((d) =>
                            d.id === doc.id
                              ? {
                                  ...d,
                                  status: 'idle',
                                  file: null,
                                  preview: null,
                                  uploadedUrl: null,
                                }
                              : d
                          )
                        );
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              )}

              {doc.status === 'error' && (
                <div className="border-2 border-red-300 bg-red-50 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <XCircleIcon className="text-red-600 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-red-700">
                        Upload failed. Please try again
                      </span>
                    </div>
                    <button
                      onClick={() => handleRetry(doc.id)}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit Section */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {!allUploaded && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 text-center">
                Please upload all {documents.length} required documents before
                submitting.
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`w-3 h-3 rounded-full ${
                      doc.status === 'success'
                        ? 'bg-green-500'
                        : doc.status === 'error'
                        ? 'bg-red-500'
                        : doc.status === 'uploading'
                        ? 'bg-orange-500'
                        : 'bg-gray-300'
                    }`}
                    title={doc.label}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!allUploaded || submitting}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              allUploaded && !submitting
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Documents'
            )}
          </button>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            sitNride is a technology platform connecting riders with independent
            drivers. sitNride does not provide transportation services.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadDocumentsPage;
