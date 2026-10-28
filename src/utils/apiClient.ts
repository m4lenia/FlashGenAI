/**
 * Universal safe API client for FlashGen AI
 * Handles Vercel 4.5MB payload limit, 404 missing serverless routes,
 * HTML error responses, timeouts, and Gemini API key diagnostics.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export async function safeApiPost<T = any>(
  endpoint: string,
  payload: any,
  timeoutMs: number = 240000 // 4 minutes timeout for long teacher documents & textbooks
): Promise<ApiResponse<T>> {
  try {
    let bodyString: string;
    try {
      bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    } catch {
      return {
        success: false,
        error: 'Failed to serialize request data. Please check your inputs.',
      };
    }

    // Vercel serverless functions enforce a strict 4.5 MB request body limit
    const bodyBytes = new Blob([bodyString]).size;
    const bodyMb = bodyBytes / (1024 * 1024);
    if (bodyBytes > 4.2 * 1024 * 1024) {
      return {
        success: false,
        error: `Payload size (${bodyMb.toFixed(1)}MB) exceeds Vercel's 4.5MB serverless limit. Please compress images/PDFs or upload fewer files at once.`,
        statusCode: 413,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: bodyString,
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      if (fetchErr.name === 'AbortError') {
        return {
          success: false,
          error: `Generation request timed out after ${Math.round(timeoutMs / 1000)} seconds. For exceptionally long teacher materials (e.g. 50+ pages), enable Turbo Speed or split the document into smaller chapters.`,
          statusCode: 504,
        };
      }
      return {
        success: false,
        error: `Network connection failed: ${fetchErr?.message || 'Unable to reach server'}. Please check your internet connection.`,
      };
    } finally {
      clearTimeout(timer);
    }

    // Safely retrieve raw text to avoid SyntaxError: Unexpected token 'T', "The page c"... is not valid JSON
    const responseText = await response.text();

    // Check for Vercel 413 Payload Too Large HTML page
    if (
      response.status === 413 ||
      responseText.includes('request entity is too large') ||
      responseText.includes('FUNCTION_PAYLOAD_TOO_LARGE') ||
      responseText.toLowerCase().includes('payload too large')
    ) {
      return {
        success: false,
        error: 'Upload exceeded Vercel serverless limit (4.5MB). Please upload smaller files or compress your PDFs/images.',
        statusCode: 413,
      };
    }

    // Check for Vercel 404 Not Found HTML page
    if (
      response.status === 404 ||
      responseText.includes('The page could not be found') ||
      responseText.includes('404: NOT_FOUND')
    ) {
      return {
        success: false,
        error: `Backend endpoint "${endpoint}" not found (404). If running on Vercel, verify that vercel.json is present and the latest deployment has finished.`,
        statusCode: 404,
      };
    }

    // Check for Vercel 504 Gateway Timeout
    if (
      response.status === 504 ||
      responseText.includes('FUNCTION_INVOCATION_TIMEOUT') ||
      responseText.includes('Gateway Timeout')
    ) {
      return {
        success: false,
        error: 'Serverless function timed out (504). Please try generating fewer flashcards (e.g. 10 instead of 30) or use a shorter document.',
        statusCode: 504,
      };
    }

    // Check if response is HTML instead of JSON
    const trimmed = responseText.trim();
    if (
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<head') ||
      trimmed.startsWith('The page')
    ) {
      return {
        success: false,
        error: `Server returned an HTML error (HTTP ${response.status}) instead of JSON. Ensure GEMINI_API_KEY is configured in your Vercel Project Settings > Environment Variables.`,
        statusCode: response.status,
      };
    }

    // Parse JSON safely
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: `Unexpected server response (HTTP ${response.status}): ${responseText.slice(0, 100)}...`,
        statusCode: response.status,
      };
    }

    // Check for application errors
    if (!response.ok || (parsed && parsed.success === false) || parsed?.error) {
      let errMsg = parsed?.error || `Request failed with HTTP status ${response.status}`;
      if (errMsg.includes('GEMINI_API_KEY')) {
        errMsg =
          'GEMINI_API_KEY is missing or invalid! On Vercel: go to Project Settings > Environment Variables, add GEMINI_API_KEY, and Redeploy.';
      }
      return {
        success: false,
        error: errMsg,
        data: parsed,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: parsed,
      statusCode: response.status,
    };
  } catch (err: any) {
    console.error('safeApiPost fatal error:', err);
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred during the request.',
    };
  }
}
