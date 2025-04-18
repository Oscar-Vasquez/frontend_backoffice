"use client";

import { useState, useEffect, useRef } from "react";
import { UsersService } from "@/app/services/users.service";
import { ExtendedFirebaseUser } from "../types";
import { useDebounce } from "@/app/hooks/useDebounce";
import { customToast } from "@/app/lib/toast";

interface UseUserSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  userDetails: ExtendedFirebaseUser | null;
  setUserDetails: React.Dispatch<React.SetStateAction<ExtendedFirebaseUser | null>>;
  suggestions: ExtendedFirebaseUser[];
  showSuggestions: boolean;
  loading: boolean;
  handleSearch: (query?: string) => Promise<ExtendedFirebaseUser | undefined>;
  handleSuggestionClick: (user: ExtendedFirebaseUser) => Promise<ExtendedFirebaseUser>;
  suggestionsRef: React.RefObject<HTMLDivElement>;
  disableAutoSuggestions: (disabled: boolean) => void;
}

export function useUserSearch(): UseUserSearchResult {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<ExtendedFirebaseUser | null>(null);
  const [suggestions, setSuggestions] = useState<ExtendedFirebaseUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [autoSuggestionsDisabled, setAutoSuggestionsDisabled] = useState(false);

  const disableAutoSuggestions = (disabled: boolean) => {
    console.log(`${disabled ? '🔒 Desactivando' : '🔓 Activando'} sugerencias automáticas`);
    setAutoSuggestionsDisabled(disabled);
    
    if (disabled) {
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (searchQuery.trim().length >= 2) {
      // Si estamos habilitando las sugerencias y hay una consulta válida,
      // refrescar las sugerencias inmediatamente
      fetchSuggestionsForQuery(searchQuery);
    }
  };

  const fetchSuggestionsForQuery = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const result = await UsersService.searchSuggestions(query);
      if (Array.isArray(result) && result.length > 0) {
        const extendedUsers = result.map(user => ({
          ...user,
          userId: user.id,
          accountStatus: typeof user.accountStatus === 'boolean' 
            ? (user.accountStatus ? 'active' : 'inactive') 
            : (user.accountStatus || 'inactive')
        } as unknown as ExtendedFirebaseUser));
        
        setSuggestions(extendedUsers);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("❌ Error al obtener sugerencias:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoSuggestionsDisabled) {
      return;
    }
    
    // Necesitamos esta versión inline para evitar problemas con las dependencias del efecto
    const fetchSuggestions = async () => {
      const query = debouncedSearchQuery;
      if (!query.trim() || query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);
      try {
        const result = await UsersService.searchSuggestions(query);
        if (Array.isArray(result) && result.length > 0) {
          const extendedUsers = result.map(user => ({
            ...user,
            userId: user.id,
            accountStatus: typeof user.accountStatus === 'boolean' 
              ? (user.accountStatus ? 'active' : 'inactive') 
              : (user.accountStatus || 'inactive')
          } as unknown as ExtendedFirebaseUser));
          
          setSuggestions(extendedUsers);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("❌ Error al obtener sugerencias:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSuggestions();
  }, [debouncedSearchQuery, autoSuggestionsDisabled]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Buscando usuario:', searchTerm);
      
      let result = await UsersService.searchUser(searchTerm);
      
      if (!result && searchTerm.includes(' ')) {
        console.log('⚠️ No se encontró con búsqueda directa, intentando con sugerencias...');
        
        const suggestions = await UsersService.searchSuggestions(searchTerm);
        
        if (suggestions && suggestions.length > 0) {
          result = suggestions[0];
          console.log('✅ Usuario encontrado en sugerencias:', result?.email);
        } else {
          const firstTerm = searchTerm.split(' ')[0];
          console.log('🔍 Última chance: buscando solo con el primer término:', firstTerm);
          
          const firstTermResults = await UsersService.searchSuggestions(firstTerm);
          
          const matchingResult = firstTermResults.find(user => 
            `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
          );
          
          if (matchingResult) {
            result = matchingResult;
            console.log('✅ Usuario encontrado por coincidencia parcial:', result.email);
          }
        }
      }
      
      if (!result) {
        throw new Error('No se encontró el usuario');
      }

      const extendedUser: ExtendedFirebaseUser = {
        ...result,
        userId: result.id,
        accountStatus: typeof result.accountStatus === 'boolean' 
          ? (result.accountStatus ? 'active' : 'inactive') 
          : (result.accountStatus as string || 'inactive')
      };

      const userId = extendedUser.id || extendedUser.userId;
      if (!userId) {
        throw new Error('No se pudo obtener el ID del usuario');
      }

      setUserDetails(extendedUser);
      setSuggestions([]);
      setShowSuggestions(false);
      
      return extendedUser;
    } catch (error) {
      console.error("❌ Error en búsqueda:", error);
      customToast.error({
        title: "Error de Búsqueda",
        description: error instanceof Error ? error.message : "No se pudo encontrar el usuario"
      });
      setUserDetails(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = async (user: ExtendedFirebaseUser) => {
    setSearchQuery(`${user.firstName} ${user.lastName}`);
    setShowSuggestions(false);
    
    try {
      setLoading(true);
      console.log('🔍 Procesando usuario seleccionado:', user);
      
      const userId = user.id || user.userId;
      if (!userId) {
        throw new Error('No se pudo obtener el ID del usuario');
      }
      
      const userHasCompleteInfo = 
        user.firstName && 
        user.lastName && 
        user.email && 
        (typeof user.accountStatus !== 'undefined');
      
      if (userHasCompleteInfo) {
        console.log('✅ Usuario ya tiene datos completos, evitando consulta adicional');
        
        if (typeof user.accountStatus === 'boolean') {
          user.accountStatus = user.accountStatus ? 'active' : 'inactive';
        }
        
        setUserDetails(user);
        return user;
      }
      
      console.log('⚠️ Usuario incompleto, obteniendo más detalles...');
      const fullUserDetails = await UsersService.searchUser(userId);
      
      if (!fullUserDetails) {
        throw new Error('No se pudo obtener información completa del usuario');
      }
      
      const extendedUser: ExtendedFirebaseUser = {
        ...fullUserDetails,
        userId: fullUserDetails.id,
        accountStatus: typeof fullUserDetails.accountStatus === 'boolean' 
          ? (fullUserDetails.accountStatus ? 'active' : 'inactive') 
          : (fullUserDetails.accountStatus as string || 'inactive')
      };
      
      setUserDetails(extendedUser);
      return extendedUser;
    } catch (error) {
      console.error("❌ Error al procesar usuario:", error);
      customToast.error({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo procesar el usuario"
      });
      setUserDetails(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    userDetails,
    setUserDetails,
    suggestions,
    showSuggestions,
    loading,
    handleSearch,
    handleSuggestionClick,
    suggestionsRef,
    disableAutoSuggestions
  };
} 