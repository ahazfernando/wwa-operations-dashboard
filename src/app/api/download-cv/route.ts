import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const mode = searchParams.get('mode') || 'download'; // 'download' or 'view'

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate that the URL is from Cloudinary (security check)
    if (!url.includes('res.cloudinary.com') && !url.includes('cloudinary.com')) {
      return NextResponse.json(
        { error: 'Invalid URL. Only Cloudinary URLs are allowed.' },
        { status: 400 }
      );
    }

    // Normalize the URL - ensure it uses the correct format for raw files
    // Cloudinary raw files should use: https://res.cloudinary.com/{cloud_name}/raw/upload/{public_id}
    let normalizedUrl = url;
    
    // If it's a secure_url from upload response, it should already be correct
    // But if it's missing the /raw/ part for raw files, we need to fix it
    if (normalizedUrl.includes('/image/upload/') && normalizedUrl.includes('candidate-cvs')) {
      // This might be a raw file incorrectly using image URL format
      normalizedUrl = normalizedUrl.replace('/image/upload/', '/raw/upload/');
    }

    // Fetch the file from Cloudinary
    // For raw files uploaded with unsigned preset set to "Public", they should be publicly accessible
    const response = await fetch(normalizedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': request.headers.get('referer') || process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // Try to get more details about the error
      let errorDetails: any = {
        status: response.status,
        statusText: response.statusText,
        url: normalizedUrl,
        originalUrl: url,
      };
      
      try {
        const errorText = await response.text();
        errorDetails.errorText = errorText.substring(0, 500); // Limit error text length
        try {
          errorDetails.errorJson = JSON.parse(errorText);
        } catch (e) {
          // Not JSON, that's fine
        }
      } catch (e) {
        // Couldn't read error text
      }
      
      console.error('Failed to fetch from Cloudinary:', errorDetails);
      
      // If it's a 401, provide more helpful error message
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { 
            error: 'File access denied. The CV file may be private or require authentication.',
            message: 'The CV file cannot be accessed. Please check Cloudinary settings: 1) Ensure the upload preset "www-dashboard" has "Access control" set to "Public", 2) Check that "Resource type" allows "Raw" files, 3) Verify the file was uploaded with the correct preset.',
            status: response.status,
            statusText: response.statusText,
            troubleshooting: {
              presetName: 'www-dashboard',
              requiredSettings: [
                'Access control: Public',
                'Resource type: Raw (or Auto)',
                'Signing mode: Unsigned (for client uploads)'
              ]
            }
          },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch file from Cloudinary',
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        },
        { status: response.status }
      );
    }

    // Get the file content
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    // Determine content type from response or blob
    const contentType = response.headers.get('content-type') || blob.type || 'application/pdf';

    // Get filename from URL or use default
    const urlPath = new URL(url).pathname;
    const filename = urlPath.split('/').pop() || 'CV.pdf';

    // Set Content-Disposition based on mode
    const contentDisposition = mode === 'view' 
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    // Return the file with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error in download-cv API route:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

