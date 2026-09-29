import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import { getGeminiClient, getEmbeddingModel } from "../config/gemini";

export interface VectorPayload {
  contactId?: string;
  threadId: string;
  messageId: string;
  text: string;
  type: "episodic" | "semantic";
  category?: string;
  timestamp: string;
}

export class VectorService {
  private static qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
  });

  private static getGemini(): OpenAI {
    return getGeminiClient();
  }

  private static COLLECTION_NAME = "executive_memory";

  /** Vector size for the collection — must match the embedding request. */
  private static readonly EMBEDDING_DIMENSIONS = 1536;

  /**
   * Initializes the vector database collection with appropriate indexing configurations.
   */
  public static async initCollection(): Promise<void> {
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === this.COLLECTION_NAME
    );

    if (!exists) {
      await this.qdrant.createCollection(this.COLLECTION_NAME, {
        vectors: {
          size: this.EMBEDDING_DIMENSIONS,
          distance: "Cosine",
        },
      });

      // Set up payload indexes for high-throughput filtering
      await this.qdrant.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: "contactId",
        field_schema: "keyword",
      });

      await this.qdrant.createPayloadIndex(this.COLLECTION_NAME, {
        field_name: "type",
        field_schema: "keyword",
      });
    }
  }

  public static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.getGemini().embeddings.create({
        model: getEmbeddingModel(),
        input: text,
        dimensions: this.EMBEDDING_DIMENSIONS,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      console.warn(`[VectorService] Embedding generation failed: ${error.message || error}. Falling back to deterministic mock vector for free development mode.`);

      const vector: number[] = new Array(this.EMBEDDING_DIMENSIONS).fill(0);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      for (let j = 0; j < this.EMBEDDING_DIMENSIONS; j++) {
        vector[j] = Math.sin(hash + j);
      }
      return vector;
    }
  }

  /**
   * Upserts a vectorized memory record into the Qdrant database.
   */
  public static async upsertMemory(
    id: string,
    text: string,
    payload: VectorPayload
  ): Promise<void> {
    const vector = await this.generateEmbedding(text);
    await this.qdrant.upsert(this.COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload: payload as any,
        },
      ],
    });
  }

  /**
   * Performs vector similarity search, applying metadata filters.
   */
  public static async searchSimilarMemories(params: {
    queryText: string;
    contactId?: string;
    limit?: number;
    type?: "episodic" | "semantic";
  }): Promise<Array<{ id: string | number; score: number; payload: VectorPayload }>> {
    const vector = await this.generateEmbedding(params.queryText);
    const limit = params.limit || 5;

    const filterMust: any[] = [];

    if (params.contactId) {
      filterMust.push({
        key: "contactId",
        match: {
          value: params.contactId,
        },
      });
    }

    if (params.type) {
      filterMust.push({
        key: "type",
        match: {
          value: params.type,
        },
      });
    }

    const results = await this.qdrant.search(this.COLLECTION_NAME, {
      vector,
      filter: filterMust.length ? { must: filterMust } : undefined,
      limit,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload as unknown as VectorPayload,
    }));
  }
}
