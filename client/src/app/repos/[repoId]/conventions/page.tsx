/* Conventions — /repos/:repoId/conventions (server/specs/003-conventions.md):
   scan the repo for house conventions, accept / reject / edit them, and build a
   repo-conventions skill from the accepted ones. */
"use client";

import { useParams } from "next/navigation";
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  const { repoId } = useParams<{ repoId: string }>();
  return <ConventionsView repoId={repoId} />;
}
