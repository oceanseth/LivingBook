// Build-time model download: bakes the MiniLM embedding model into the image
// so container cold starts don't fetch from HuggingFace.
import { pipeline } from '@xenova/transformers';

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const out = await embed('warmup', { pooling: 'mean', normalize: true });
console.log('model warm, dim =', out.data.length);
