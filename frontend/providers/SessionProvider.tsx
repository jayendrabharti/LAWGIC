"use client";

import getUser from "@/auth/getUser";
import ApiClient from "@/utils/ApiClient";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  SetStateAction,
  Dispatch,
} from "react";
import { toast } from "sonner";

export interface SessionContextType {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
  error: string | null;
  refreshSession: () => Promise<void>;
  setUser: Dispatch<SetStateAction<User | null>>;
  logOut: (redirect?: boolean) => Promise<void>;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  status: "loading",
  error: null,
  refreshSession: async () => {},
  setUser: () => {},
  logOut: async (redirect: boolean = false) => {},
});

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionContextType["user"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionContextType["status"]>("loading");

  const router = useRouter();

  const fetchSession = async () => {
    setUser(null);
    setStatus("loading");
    setError(null);

    try {
      const user = await getUser();
      if (user) {
        setUser(user);
        console.log("User fetched:", user);
        setStatus("authenticated");
        console.log("Session status: authenticated");
      } else {
        setUser(null);
        console.log("User not found");

        setStatus("unauthenticated");
        console.log("Session status: unauthenticated");
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
      setError("Failed to fetch session");
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  const logOut = async (redirect: boolean = false) => {
    const { data } = await ApiClient.post("/auth/logout");
    if (data.success) {
      setUser(null);
      setError(null);
      setStatus("unauthenticated");
      toast.success("Signed out !!");
      if (redirect) {
        router.push("/login");
      }
    } else {
      toast.error("Error signing out");
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const contextValue: SessionContextType = {
    user,
    status,
    error,
    refreshSession: fetchSession,
    setUser,
    logOut,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};
