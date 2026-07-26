// Runtime API endpoint. Empty string = same-origin: CloudFront routes /api/*
// to the App Runner service. Update via S3 upload + invalidation, no rebuild.
window.__API__ = '';
