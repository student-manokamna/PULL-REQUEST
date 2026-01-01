// import { pineconeIndex } from "@/lib/pinecone";
// import { embed } from "ai"
// import {google} from "@ai-sdk/google"

// export async function generateEmbeddings(text: string){
//     const {embedding}= await embed({
//         model: google.textEmbeddingModel("text-embedding-004"),
//         value: text
//     })
//     return embedding;
// }
//     export async function indexCodebase(repoId: string, files: { path: string; content: string }[]) {
//     const vectors = [];

//     for (const file of files) {
//         const content = `File: ${file.path}\n\n${file.content}`;

//         const truncatedContent = content.slice(0, 8000);

//         try {
//             const embedding = await generateEmbeddings(truncatedContent);

//             vectors.push({
//                 id: `${repoId}-${file.path.replace(/\//g, '_')}`,
//                 values: embedding,
//                 metadata: {
//                     repoId,
//                     path: file.path,
//                     content: truncatedContent
//                 }
//             });
//         } catch (error) {
//             console.error(`Error generating embedding for file ${file.path}:`, error);
//         }
//     }
//     if (vectors.length > 0) {
//         const batchSize= 100;
//         for(let i=0; i< vectors.length; i+= batchSize){
//             const chunk= vectors.slice(i, i+ batchSize);
//             await pineconeIndex.upsert(chunk);
//         }
//     }
//     console.log(`Indexed ${vectors.length} files for repo ${repoId}`);
// }

// export async function retrieveContext(query: string, repoId: string, topK: number = 5) {
//     const embedding = await generateEmbeddings(query);

//     const results = await pineconeIndex.query({
//         vector: embedding,
//         filter: { repoId },
//         topK,
//         includeMetadata: true
//     });

//     return results.matches.map(match => match.metadata?.content as string).filter(Boolean);
// }

import { pineconeIndex } from "@/lib/pinecone";
import { embed } from "ai";
import { google } from "@ai-sdk/google";


/**
 * Generate embeddings safely
 * Fixed: Added proper error handling for Google API quotas.
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  if (!text || !text.trim()) return [];

  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: text.slice(0, 3000), // Ensures we stay within token limits
    });

    return embedding;
  } catch (err: any) {
    const msg = err?.message || "";
    // 🚫 Do not retry if quota is hit to avoid hanging the function
    if (
      msg.includes("quota") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("429")
    ) {
      console.error("🚫 Google quota exceeded. Skipping embedding.");
      return [];
    }
    throw err;
  }
}

/**
 * Index repository files into Pinecone
 * Fixed: Removed the unreliable "Zero Vector" check that was causing indexing to be skipped.
 * Fixed: Reduced throttle to 200ms to prevent the 1.9m Inngest timeout.
 */
export async function indexCodebase(
  repoId: string,
  files: { path: string; content: string }[]
) {
  const vectors: any[] = [];

  for (const file of files) {
    const content = `File: ${file.path}\n\n${file.content}`;
    const truncatedContent = content.slice(0, 3000); 

    const embedding = await generateEmbeddings(truncatedContent);

    if (!embedding.length) continue;

    vectors.push({
      id: `${repoId}-${file.path.replace(/[^\w]/g, "_")}`,
      values: embedding,
      metadata: {
        repoId,
        path: file.path,
        content: truncatedContent,
      },
    });

    // ⚡ Faster throttle (200ms) to stay within serverless execution limits.
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!vectors.length) {
    console.warn("⚠️ No vectors generated, skipping Pinecone upsert");
    return;
  }

  // Batch upserts to Pinecone
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const chunk = vectors.slice(i, i + batchSize);
    await pineconeIndex.upsert(chunk);
  }

  console.log(`✅ Indexed ${vectors.length} files for repo ${repoId}`);
}

/**
 * Retrieve relevant context
 * Fixed: Ensure the repoId filter matches exactly what was indexed.
 */
export async function retrieveContext(
  query: string,
  repoId: string,
  topK = 5
): Promise<string[]> {
  const embedding = await generateEmbeddings(query);

  if (!embedding.length) return [];

  const results = await pineconeIndex.query({
    vector: embedding,
    filter: { repoId }, // CRITICAL: This must match the ID used in indexCodebase
    topK,
    includeMetadata: true,
  });

  return (
    results.matches
      ?.map((m) => m.metadata?.content as string)
      .filter(Boolean) ?? []
  );
}