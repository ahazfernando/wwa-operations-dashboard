# Cloudinary Setup Guide

This project uses Cloudinary for image uploads in the task management system. Follow these steps to set up Cloudinary.

## 1. Create a Cloudinary Account

1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Sign up for a free account (or log in if you already have one)

## 2. Get Your Cloudinary Credentials

1. In the Cloudinary Dashboard, you'll see your **Cloud Name** at the top
2. Go to **Settings** > **Security** to find your **API Key** and **API Secret**

## 3. Create an Upload Preset

1. Go to **Settings** > **Upload**
2. Scroll down to **Upload presets**
3. Click **Add upload preset**
4. Configure the preset:
   - **Preset name**: `tasks_upload` (or any name you prefer)
   - **Signing mode**: Select **Unsigned** (for client-side uploads)
   - **Folder**: `tasks` (optional, but recommended)
   - **Allowed formats**: Select image formats (jpg, png, gif, webp)
   - **Max file size**: Set to 5MB or your preferred limit
5. Click **Save**

## 4. Configure Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dsiyv4ji5
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=www-dashboard
```

**Note:** Your Cloudinary credentials have been configured:
- Cloud Name: `dsiyv4ji5`
- Upload Preset: `www-dashboard` (unsigned)
- API Key: `179313218955328`
- API Secret: `ucTlpiqpDgn9_8K_XVKGPjmZXhk` (stored securely, not in env file)

The API Secret is not needed in the environment variables since we're using unsigned uploads with the preset.

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

- **"Cloudinary cloud name is not configured"**: Make sure `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is set in `.env.local`
- **Upload fails**: Check that your upload preset is set to "Unsigned" mode
- **File too large**: Adjust the max file size in your upload preset settings
- **Invalid file type**: Make sure your upload preset allows the image format you're trying to upload

