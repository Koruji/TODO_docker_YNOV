// Formes des données échangées avec le backend (voir com.todo.dto)

// Dates au format 'YYYY-MM-DD'
export type IsoDate = string

export interface User {
  id: number
  username: string
  email: string
  profilePicture: string | null
}

export interface Task {
  id: number
  label: string
  description: string
  startDate: IsoDate | null
  endDate: IsoDate | null
  place: string | null
  level: number | null
  done: boolean
  doneAt: IsoDate | null
  reminder: boolean
  user: User
  collaborator: User | null
}

export interface TaskRequest {
  label: string
  description: string
  startDate: IsoDate | null
  endDate: IsoDate | null
  place: string | null
  level: number | null
  collaboratorId: number | null
  done: boolean
}

export interface DailyActivity {
  date: IsoDate
  created: number
  done: number
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Session {
  token: string
  user: User
}

export interface UserUpdateRequest {
  username: string
  email: string
  profilePicture: string | null
}

export interface PasswordUpdateRequest {
  currentPassword: string
  newPassword: string
}

// Critères de recherche : les critères vides ne sont pas envoyés
export interface SearchCriteria {
  q?: string
  startDate?: IsoDate
  endDate?: IsoDate
  place?: string
  levels?: number[]
  done?: boolean
}

// Erreurs de validation par champ renvoyées par le backend
export type FieldErrors = Record<string, string>
