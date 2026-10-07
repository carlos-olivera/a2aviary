import OpenAI from "openai";
import { S3Client } from "@aws-sdk/client-s3";
import { BucketStore } from "./storage.ts";
import { StaticAgentsVerifier } from "./static-verification.ts";
import { StaticRailwayProvider } from "./static-railway.ts";
import type { ObjectStore } from "./storage.ts";
import type { StaticVerifier, StaticProvider } from "./static.ts";
export interface ManagedDependencies {
  objects: ObjectStore;
  verifier: StaticVerifier;
  provider: StaticProvider;
  deploymentEnabled: boolean;
  handoffEnabled: boolean;
}
export function staticRuntime(
  env: NodeJS.ProcessEnv = process.env,
): ManagedDependencies | undefined {
  for (const name of [
    "MANAGED_STATIC_SITES_ENABLED",
    "MANAGED_STATIC_DEPLOY_ENABLED",
    "MANAGED_STATIC_HANDOFF_ENABLED",
  ])
    if (env[name] && !["true", "false"].includes(env[name]!))
      throw Error("Invalid " + name);
  if (env.MANAGED_STATIC_SITES_ENABLED !== "true") return undefined;
  const required = (name: string) => {
    const v = env[name]?.trim();
    if (!v) throw Error("Missing " + name);
    return v;
  };
  const endpoint = required("SITE_BUCKET_ENDPOINT");
  if (new URL(endpoint).protocol !== "https:")
    throw Error("SITE_BUCKET_ENDPOINT must use HTTPS");
  const protectedIds = new Set(
    required("SITE_PROTECTED_PROJECT_IDS")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  if (env.RAILWAY_PROJECT_ID) protectedIds.add(env.RAILWAY_PROJECT_ID);
  return {
    objects: new BucketStore(
      new S3Client({
        endpoint,
        region: required("SITE_BUCKET_REGION"),
        forcePathStyle: env.SITE_BUCKET_FORCE_PATH_STYLE !== "false",
        credentials: {
          accessKeyId: required("SITE_BUCKET_ACCESS_KEY_ID"),
          secretAccessKey: required("SITE_BUCKET_SECRET_ACCESS_KEY"),
        },
      }),
      required("SITE_BUCKET_NAME"),
    ),
    verifier: new StaticAgentsVerifier(
      new OpenAI({ apiKey: required("OPENAI_API_KEY") }),
    ),
    provider: new StaticRailwayProvider({
      apiToken: required("RAILWAY_API_TOKEN"),
      protectedProjectIds: protectedIds,
    }),
    deploymentEnabled: env.MANAGED_STATIC_DEPLOY_ENABLED === "true",
    handoffEnabled: env.MANAGED_STATIC_HANDOFF_ENABLED === "true",
  };
}
