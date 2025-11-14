export interface UploadResult {
  url: string;
  public_id: string;
}

/**
 * Upload image to Cloudinary using unsigned upload
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 * @param file - File object to upload
 * @param folder - Optional folder path in Cloudinary
 * @returns Promise with upload result containing URL and public_id
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: string = 'tasks'
): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'tasks_upload';

  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload image');
    }

    const result = await response.json();

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Upload PDF or other raw file to Cloudinary using unsigned upload
 * Requires NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 * @param file - File object to upload (PDF or other document)
 * @param folder - Optional folder path in Cloudinary
 * @returns Promise with upload result containing URL and public_id
 */
export async function uploadFileToCloudinary(
  file: File,
  folder: string = 'tasks'
): Promise<UploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'tasks_upload';

  if (!cloudName) {
    throw new Error('Cloudinary cloud name is not configured');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);
  formData.append('resource_type', 'raw'); // Use raw for PDFs and other documents

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload file');
    }

    const result = await response.json();

    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Delete image from Cloudinary
 * Note: This requires a server-side API route with API secret
 * @param publicId - Public ID of the image to delete
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  try {
    const response = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicId }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete image');
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    throw error;
  }
}

