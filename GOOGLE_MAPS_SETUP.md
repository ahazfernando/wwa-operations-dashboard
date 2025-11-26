# Google Maps API Setup Guide

This project uses Google Maps JavaScript API for the interactive map with draggable marker on the Work From Home Location page.

## 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Maps JavaScript API**:
   - Go to **APIs & Services** > **Library**
   - Search for "Maps JavaScript API"
   - Click on it and click **Enable**

## 2. Create an API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy your API key
4. (Recommended) Restrict the API key:
   - Click on the API key to edit it
   - Under **Application restrictions**, select **HTTP referrers (web sites)**
   - Add your domain(s), e.g., `localhost:3000/*`, `yourdomain.com/*`
   - Under **API restrictions**, select **Restrict key** and choose **Maps JavaScript API**
   - Click **Save**

## 3. Add Environment Variable

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual Google Maps API key.

## 4. Restart Your Development Server

After adding the environment variable, restart your Next.js development server:

```bash
npm run dev
```

## Features

- **Interactive Map**: Users can see their location on a Google Map
- **Draggable Marker**: Users can drag the pin to set their exact work-from-home location
- **Auto Address Lookup**: When the marker is moved, the address is automatically updated using reverse geocoding
- **Current Location**: Users can click "Use Current Location" to automatically set their location

## Cost

Google Maps JavaScript API has a free tier:
- **$200 free credit per month** (covers most small to medium applications)
- After free credit: $7 per 1,000 map loads

For most applications, the free tier is sufficient. Monitor your usage in the Google Cloud Console.

## Troubleshooting

### Map Not Showing

- Check that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set in your `.env.local` file
- Verify the API key is valid and has Maps JavaScript API enabled
- Check browser console for any error messages
- Ensure your API key restrictions allow your domain

### "This page can't load Google Maps correctly" Error

- Check that your API key is correct
- Verify that Maps JavaScript API is enabled in your Google Cloud project
- Check API key restrictions if you've set them up

