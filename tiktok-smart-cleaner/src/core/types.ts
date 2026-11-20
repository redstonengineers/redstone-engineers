/** Una cuenta tal y como aparece en el export de TikTok. */
export interface RawEntry {
  /** Nombre de usuario tal cual aparece en el archivo. */
  username: string;
  /** Fecha ISO-like tal cual la entrega TikTok (opcional). */
  date?: string;
}

export interface ParsedFile {
  fileName: string;
  followers: RawEntry[];
  following: RawEntry[];
  /** Entradas encontradas sin saber si son seguidores o seguidos (TXT sin secciones). */
  unassigned: RawEntry[];
}

/** Datos importados y normalizados. Es lo único que se persiste localmente. */
export interface ImportedData {
  importedAt: string;
  sources: string[];
  /** clave = usuario normalizado */
  followers: Record<string, AccountSource>;
  following: Record<string, AccountSource>;
}

export interface AccountSource {
  /** Nombre original (para mostrar). */
  display: string;
  date?: string;
}

export type Category = "friend" | "nonMutual" | "followerOnly";

export interface ClassifiedAccount {
  key: string;
  display: string;
  category: Category;
  /** Sigo a esta cuenta */
  iFollow: boolean;
  /** Esta cuenta me sigue */
  followsMe: boolean;
  /** Marcada manualmente en la lista blanca */
  whitelisted: boolean;
  /** Fecha en la que la empecé a seguir / me empezó a seguir */
  date?: string;
  /** true si es candidata a dejar de seguir (sigo, no me sigue, no está en lista blanca) */
  removable: boolean;
}

export interface Stats {
  totalFollowing: number;
  totalFollowers: number;
  mutualFriends: number;
  whitelistedKept: number;
  /** amigos mutuos + lista blanca (cuentas seguidas que se conservan) */
  friends: number;
  /** sigo y no me siguen, sin contar la lista blanca (= candidatas a revisar) */
  nonMutual: number;
  followersOnly: number;
  keepPercent: number;
}
