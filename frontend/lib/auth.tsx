"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { User, authApi } from "./api";

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string) => Promise<User>;
    logout: () => void;
    loading: boolean;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // On mount — restore session from localStorage
    useEffect(() => {
        const savedToken = localStorage.getItem("pt_token");
        const savedUser = localStorage.getItem("pt_user");

        if (savedToken && savedUser) {
            try {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));

                // Verify token is still valid
                authApi
                    .getMe(savedToken)
                    .then((freshUser) => {
                        setUser(freshUser);
                        localStorage.setItem("pt_user", JSON.stringify(freshUser));
                    })
                    .catch(() => {
                        // Token expired or invalid — clear session
                        localStorage.removeItem("pt_token");
                        localStorage.removeItem("pt_user");
                        setToken(null);
                        setUser(null);
                    });
            } catch {
                localStorage.removeItem("pt_token");
                localStorage.removeItem("pt_user");
            }
        }

        setLoading(false);
    }, []);

    const login = async (username: string): Promise<User> => {
        const loggedInUser = await authApi.login(username);
        setUser(loggedInUser);
        setToken(loggedInUser.session_token);
        localStorage.setItem("pt_token", loggedInUser.session_token);
        localStorage.setItem("pt_user", JSON.stringify(loggedInUser));
        return loggedInUser;
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("pt_token");
        localStorage.removeItem("pt_user");
    };

    const updateUser = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem("pt_user", JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider
            value={{ user, token, login, logout, loading, updateUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}