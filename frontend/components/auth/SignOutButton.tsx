"use client";
import { Loader2Icon, LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { Button } from "../ui/button";
import { useSession } from "@/providers/SessionProvider";

export default function SignOutButton({
  className = "",
  redirect = false,
}: {
  className?: string;
  redirect?: boolean;
}) {
  const { logOut } = useSession();

  const [signingOut, startSignOut] = useTransition();

  return (
    <Button
      onClick={() => {
        startSignOut(async () => {
          await logOut(redirect);
        });
      }}
      disabled={signingOut}
      variant={"destructive"}
      className={cn(`active:scale-90 ${className}`)}
    >
      {signingOut ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <LogOutIcon className="size-4" />
      )}
      {signingOut ? "Signing Out..." : "Sign Out"}
    </Button>
  );
}
