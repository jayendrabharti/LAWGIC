"use client"

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function DynamicFavicon(){
    const {theme, resolvedTheme} = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(()=>{
        setMounted(true);
    }, [])

    useEffect(()=>{
        if (!mounted) return;

        const currentTheme = resolvedTheme || theme;
        const faviconPath = currentTheme === 'dark' ? '/images/favicon-dark.ico' : '/images/favicon-light.ico';

        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;

        if(!link){
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = faviconPath;
    }, [theme, resolvedTheme, mounted]);

    return null;
}