import Link from "next/link";
import { Button } from "../ui/button";
import { CheckCheckIcon, HomeIcon } from "lucide-react";
import SignOutButton from "./SignOutButton";

export default function Authenticated() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <CheckCheckIcon className="size-20 text-green-500" />
      <span className="text-4xl font-bold text-green-500">Authenticated</span>
      <span className="text-muted-foreground text-sm">
        You are already logged in.
      </span>
      <div className="mt-4 flex flex-row items-center justify-center gap-2">
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            Homepage <HomeIcon />
          </Button>
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
