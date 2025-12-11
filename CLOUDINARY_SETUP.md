# Cloudinary Setup Guide

This project uses Cloudinary for image uploads in the task management system. Follow these steps to set up Cloudinary.

## 1. Create a Cloudinary Account

1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Sign up for a free account (or log in if you already have one)

## 2. Get Your Cloudinary Credentials

1. In the Cloudinary Dashboard, you'll see your **Cloud Name** at the top
2. Go to **Settings** > **Security** to find your **API Key** and **API Secret**

## 3. Create an Upload Preset

**IMPORTANT:** You must create an upload preset for the profile page to work.

1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Navigate to **Settings** > **Upload**
3. Scroll down to **Upload presets** section
4. Click **Add upload preset** button
5. Configure the preset with these exact settings:
   - **Preset name**: `wwa-operations` (must match exactly)
   - **Signing mode**: Select **Unsigned** (CRITICAL - must be unsigned for client-side uploads)
   - **Folder**: Leave empty or set to `profiles` (optional)
   - **Allowed formats**: 
     - For images: Select `jpg`, `jpeg`, `png`, `gif`, `webp`
     - For documents: Select `pdf` (or enable "All formats" to allow both)
   - **Max file size**: Set to `50MB` (or your preferred limit)
   - **Use filename**: Optional (can enable if you want to preserve original filenames)
6. Click **Save** at the bottom

**Note:** If you use a different preset name, update the `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` environment variable accordingly.

## 4. Configure Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dsiyv4ji5
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=wwa-operations
CLOUDINARY_API_KEY=179313218955328
CLOUDINARY_API_SECRET=ucTlpiqpDgn9_8K_XVKGPjmZXhk
```

**Note:** Your Cloudinary credentials have been configured:
- Cloud Name: `dsiyv4ji5`
- Upload Preset: `wwa-operations` (unsigned)
- API Key: `179313218955328`
- API Secret: `ucTlpiqpDgn9_8K_XVKGPjmZXhk` (stored securely in env file)

**Note:** The API Key and API Secret are included in the environment variables for potential server-side operations (like deleting images). For client-side uploads, only the Cloud Name and Upload Preset are required since we're using unsigned uploads.

## 5. Test the Setup

1. Start your development server: `npm run dev`
2. Log in as an admin
3. Navigate to the Tasks page
4. Try creating a new task and uploading an image
5. The image should upload successfully to Cloudinary

## Notes

- The upload preset must be set to **Unsigned** for client-side uploads to work
- Images are automatically optimized and transformed by Cloudinary
- All uploaded images are stored in the `tasks` folder in your Cloudinary account
- The free tier includes 25GB of storage and 25GB of monthly bandwidth

## Troubleshooting

- **"Upload preset not found"**: 
  - The preset `wwa-operations` doesn't exist in your Cloudinary account
  - Go to Cloudinary Dashboard → Settings → Upload → Upload presets
  - Create a new preset named `wwa-operations` and set it to "Unsigned" mode
  - Or update your `.env.local` to use an existing preset name
  
- **"Cloudinary cloud name is not configured"**: 
  - Make sure `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is set in `.env.local`
  - Restart your Next.js development server after adding environment variables
  
- **Upload fails with "Invalid preset"**: 
  - Check that your upload preset is set to **"Unsigned"** mode (not "Signed")
  - This is required for client-side uploads to work
  
- **File too large**: 
  - Adjust the max file size in your upload preset settings in Cloudinary
  - Default is 50MB in the code
  
- **Invalid file type**: 
  - Make sure your upload preset allows the file format you're trying to upload
  - For images: jpg, jpeg, png, gif, webp
  - For documents: pdf

- **"File access denied" or 401 Unauthorized when downloading CVs**:
  - **IMPORTANT**: The "Resource type" is NOT a preset setting - it's determined by the upload API endpoint used in the code (`/raw/upload` for PDFs). The issue is likely with access control settings.
  - **Step-by-step fix**:
    1. Go to Cloudinary Console → Settings → Upload → Upload presets
    2. Click on your preset (e.g., `www-dashboard`)
    3. Click on the **"Optimize and Deliver"** tab in the left sidebar (NOT "General")
    4. In the **"Optimize and Deliver"** section, check:
       - **"Access control"**: Must be set to **"Public"** (this is the most important setting!)
       - **"Delivery type"**: Should be "Upload"
       - **"Allowed formats"**: This field is in the same "Optimize and Deliver" section. You need to:
         - Click in the **"Allowed formats"** field
         - Type: `pdf, jpg, jpeg, png, gif, webp` (comma-separated list)
         - OR leave it empty to allow all formats (recommended if you upload both images and PDFs)
    5. Go back to **"General"** tab and verify:
       - **"Signing mode"**: Should be **"Unsigned"** (for client-side uploads)
    6. Click **"Save"** at the top right to apply changes
  - **If files were already uploaded**: Files uploaded BEFORE fixing these settings may still be inaccessible. You have two options:
    - **Option 1 (Recommended)**: Re-upload the CV files after fixing the preset
    - **Option 2**: Manually change access mode of existing files:
      1. Go to Media Library
      2. Find the CV file (look in the `candidate-cvs` folder)
      3. Click on it to open details
      4. In the file details panel, look for "Access mode" or "Access control"
      5. Change it to **"Public"**
      6. Click **"Save"** or **"Update"**

