import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  initializeApp,
  getApps,
} from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  deleteField,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { Upload, CalendarIcon, Pencil, Download, ArrowRight, Clock, Crown, CheckSquare, Star, FileText, User, Phone, Shield, AlertCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getCompletedTasksByUser } from '@/lib/tasks'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ImageCropDialog } from '@/components/ImageCropDialog'
import { DragDropFileUpload } from '@/components/DragDropFileUpload'
import { PhoneInput } from '@/components/PhoneInput'
import { Progress } from '@/components/ui/progress'

const FormSchema = z.object({
  fullName: z.string().optional(),
  preferredName: z.string().optional(),
  email: z.union([z.string().email("Invalid email address"), z.literal("")]).optional(),
  phone: z.string().optional(),
  dob: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), "Invalid date format"),
  jobRole: z.string().optional(),
  workLocation: z.enum(["Sri Lanka", "Australia"]).optional(),
  residentialAddress: z.string().optional(),
  postalCode: z.string().optional(),
  gender: z.enum(["Male", "Female", "Prefer not to say"]).optional(),
  employeeType: z.enum(["Subcontractor", "Full-time", "Part-time", "Intern (Trainee)"]).optional(),
  tfnAbn: z.string().optional(),
  idNumber: z.string().optional(),
  residingInAu: z.boolean().optional(),
  visaType: z.string().optional(),
  visaSubclass: z.string().optional(),
  emergency: z.object({
    fullName: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  declaration1: z.boolean().optional(),
  declaration2: z.boolean().optional(),
  isBusy: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.residingInAu && data.residingInAu === true) {
    if (data.visaType && !data.visaType.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visa type is required when residing in Australia",
        path: ["visaType"],
      });
    }
    if (data.visaSubclass && !data.visaSubclass.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visa subclass is required when residing in Australia",
        path: ["visaSubclass"],
      });
    }
  }
});

type FormDataType = z.infer<typeof FormSchema>

interface UploadField {
  file: File | null
  preview: string
}

const uploadKeys = [
  'profilePhoto',
  'idFrontPhoto',
  'idBackPhoto',
  'selfiePhoto',
  'passportPhoto',
  'contractDoc',
  'visaNotice',
] as const

type UploadKey = typeof uploadKeys[number]

type FullDataType = FormDataType & Partial<Record<UploadKey, string>> & { updatedAt: string }

const Profile: React.FC = () => {
  const form = useForm<FormDataType>({
    resolver: zodResolver(FormSchema),
    mode: 'onChange',
    criteriaMode: 'firstError',
    defaultValues: {
      fullName: '',
      preferredName: '',
      email: '',
      phone: '',
      dob: '',
      jobRole: '',
      workLocation: 'Sri Lanka',
      residentialAddress: '',
      postalCode: '',
      gender: 'Male',
      employeeType: 'Full-time',
      tfnAbn: '',
      idNumber: '',
      residingInAu: false,
      visaType: '',
      visaSubclass: '',
      emergency: {
        fullName: '',
        relationship: '',
        phone: '',
      },
      declaration1: false,
      declaration2: false,
      isBusy: false,
    },
  })

  const { toast } = useToast()
  const [uploads, setUploads] = useState<Record<UploadKey, UploadField>>({
    profilePhoto: { file: null, preview: '' },
    idFrontPhoto: { file: null, preview: '' },
    idBackPhoto: { file: null, preview: '' },
    selfiePhoto: { file: null, preview: '' },
    passportPhoto: { file: null, preview: '' },
    contractDoc: { file: null, preview: '' },
    visaNotice: { file: null, preview: '' },
  })
  const [loading, setLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState<Record<UploadKey, boolean>>({
    profilePhoto: false,
    idFrontPhoto: false,
    idBackPhoto: false,
    selfiePhoto: false,
    passportPhoto: false,
    contractDoc: false,
    visaNotice: false,
  })
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null)
  const [dobDate, setDobDate] = useState<Date | undefined>(undefined)
  const [attendanceMetrics, setAttendanceMetrics] = useState({
    totalAttendance: 0,
    completedTasks: 0,
    employeeRating: null as number | null,
    latestClockInTime: null as string | null,
  })
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const { user: authUser } = useAuth()
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState<'this-year' | 'last-year' | 'all-time'>('this-year')
  const [monthFilter, setMonthFilter] = useState<string>('all')

  const fileInputRefs = useRef<Record<UploadKey, HTMLInputElement | null>>({
    profilePhoto: null,
    idFrontPhoto: null,
    idBackPhoto: null,
    selfiePhoto: null,
    passportPhoto: null,
    contractDoc: null,
    visaNotice: null,
  })

  const triggerUpload = useCallback((key: UploadKey) => {
    fileInputRefs.current[key]?.click()
  }, [])

  const residingInAu = useWatch({ control: form.control, name: 'residingInAu' })
  
  // Watch all form values for progress calculation
  const formValues = useWatch({ control: form.control })
  
  // Calculate profile completion percentage with useMemo for optimization
  const profileProgress = React.useMemo(() => {
    const fields: Array<{ value: any; weight: number }> = []
    
    // Personal Information fields (weighted)
    fields.push({ value: formValues.fullName || formValues.preferredName, weight: 5 })
    fields.push({ value: formValues.phone, weight: 5 })
    fields.push({ value: formValues.dob, weight: 3 })
    fields.push({ value: formValues.jobRole, weight: 5 })
    fields.push({ value: formValues.workLocation, weight: 2 })
    fields.push({ value: formValues.gender, weight: 2 })
    fields.push({ value: formValues.residentialAddress, weight: 3 })
    fields.push({ value: formValues.postalCode, weight: 2 })
    fields.push({ value: formValues.employeeType, weight: 2 })
    fields.push({ value: formValues.tfnAbn, weight: 3 })
    fields.push({ value: formValues.idNumber, weight: 3 })
    
    // Documents (weighted)
    fields.push({ value: uploads.profilePhoto.preview, weight: 5 })
    fields.push({ value: uploads.idFrontPhoto.preview, weight: 8 })
    fields.push({ value: uploads.idBackPhoto.preview, weight: 8 })
    fields.push({ value: uploads.selfiePhoto.preview, weight: 5 })
    fields.push({ value: uploads.passportPhoto.preview, weight: 5 })
    fields.push({ value: uploads.contractDoc.preview, weight: 5 })
    
    // Conditional visa documents if residing in Australia
    if (residingInAu) {
      fields.push({ value: formValues.visaType, weight: 5 })
      fields.push({ value: formValues.visaSubclass, weight: 5 })
      fields.push({ value: uploads.visaNotice.preview, weight: 5 })
    }
    
    // Emergency Contact
    fields.push({ value: formValues.emergency?.fullName, weight: 5 })
    fields.push({ value: formValues.emergency?.relationship, weight: 3 })
    fields.push({ value: formValues.emergency?.phone, weight: 5 })
    
    // Declarations
    fields.push({ value: formValues.declaration1, weight: 5 })
    fields.push({ value: formValues.declaration2, weight: 5 })
    
    // Calculate total weight and completed weight
    let totalWeight = 0
    let completedWeight = 0
    
    fields.forEach(({ value, weight }) => {
      totalWeight += weight
      // Check if field is filled
      const isFilled = value !== undefined && value !== null && value !== '' && value !== false
      if (isFilled) {
        completedWeight += weight
      }
    })
    
    if (totalWeight === 0) return 0
    return Math.round((completedWeight / totalWeight) * 100)
  }, [formValues, uploads, residingInAu])

  const app = React.useMemo(() => {
    if (getApps().length === 0) {
      return initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      })
    }
    return getApps()[0]
  }, [])

  const auth = React.useMemo(() => getAuth(app), [app])
  const db = React.useMemo(() => getFirestore(app), [app])

  useEffect(() => {
    // Check Cloudinary configuration on mount
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
    if (!cloudName || !uploadPreset) {
      console.warn('Cloudinary configuration missing:', {
        cloudName: !!cloudName,
        uploadPreset: !!uploadPreset,
      })
      toast({
        variant: 'destructive',
        title: 'Cloudinary Configuration Missing',
        description: 'Image uploads may not work. Please check your environment variables (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).',
      })
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        setLoading(true)
        try {
          const docSnap = await getDoc(doc(db, 'profiles', user.uid))
          if (docSnap.exists()) {
            const data = docSnap.data() as Partial<FullDataType>
            
            // Prepare form data with proper type conversions
            const formData: Partial<FormDataType> = {}
            
            // Handle date of birth
            if (data.dob) {
              const date = new Date(data.dob as string)
              if (!isNaN(date.getTime())) {
                formData.dob = format(date, 'yyyy-MM-dd')
                setDobDate(date) // Set the date state for the Calendar component
              }
            }
            
            // Handle emergency contact
            if (data.emergency) {
              formData.emergency = {
                fullName: (data.emergency as any)?.fullName || '',
                relationship: (data.emergency as any)?.relationship || '',
                phone: (data.emergency as any)?.phone || '',
              }
            }
            
            // Handle scalar fields
            const scalarKeys: (keyof FormDataType)[] = [
              'fullName', 'preferredName', 'phone', 'jobRole', 'workLocation',
              'residentialAddress', 'postalCode', 'gender', 'employeeType', 'tfnAbn',
              'idNumber', 'visaType', 'visaSubclass'
            ]
            
            scalarKeys.forEach((key) => {
              if (data[key] !== undefined && data[key] !== null) {
                (formData as any)[key] = data[key]
              }
            })
            
            // Handle boolean fields
            if (data.residingInAu !== undefined) {
              formData.residingInAu = Boolean(data.residingInAu)
            }
            if (data.declaration1 !== undefined) {
              formData.declaration1 = Boolean(data.declaration1)
            }
            if (data.declaration2 !== undefined) {
              formData.declaration2 = Boolean(data.declaration2)
            }
            if (data.isBusy !== undefined) {
              formData.isBusy = Boolean(data.isBusy)
            }
            
            // Set email from Firebase Auth user if not in profile data
            if (!data.email && user.email) {
              formData.email = user.email
            } else if (data.email) {
              formData.email = data.email as string
            }
            
            // Reset form with all the data at once
            form.reset({
              fullName: formData.fullName || '',
              preferredName: formData.preferredName || '',
              email: formData.email || user.email || '',
              phone: formData.phone || '',
              dob: formData.dob || '',
              jobRole: formData.jobRole || '',
              workLocation: (formData.workLocation as "Sri Lanka" | "Australia") || 'Sri Lanka',
              residentialAddress: formData.residentialAddress || '',
              postalCode: formData.postalCode || '',
              gender: (formData.gender as "Male" | "Female" | "Prefer not to say") || 'Male',
              employeeType: (formData.employeeType as "Subcontractor" | "Full-time" | "Part-time" | "Intern (Trainee)") || 'Full-time',
              tfnAbn: formData.tfnAbn || '',
              idNumber: formData.idNumber || '',
              residingInAu: formData.residingInAu || false,
              visaType: formData.visaType || '',
              visaSubclass: formData.visaSubclass || '',
              emergency: formData.emergency || {
                fullName: '',
                relationship: '',
                phone: '',
              },
              declaration1: formData.declaration1 || false,
              declaration2: formData.declaration2 || false,
              isBusy: formData.isBusy || false,
            })
            
            // Set upload previews
            uploadKeys.forEach((key) => {
              if (data[key]) {
                setUploads((prev) => ({ ...prev, [key]: { ...prev[key], preview: data[key] as string } }))
              }
            })
          } else {
            // If no profile exists, at least set the email from Firebase Auth
            if (user.email) {
              form.setValue('email', user.email)
            }
          }
          
          // Load attendance metrics with current filters
          await loadAttendanceMetrics(user.uid)
        } catch (error) {
          console.error('Error loading profile:', error)
          toast({ variant: 'destructive', title: 'Error loading profile', description: 'Failed to load your profile data. Please try refreshing the page.' })
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [auth, db, form, toast])

  // Reload metrics when filters change
  useEffect(() => {
    if (currentUser) {
      loadAttendanceMetrics(currentUser.uid)
    }
  }, [periodFilter, monthFilter, currentUser])

  const loadAttendanceMetrics = async (userId: string) => {
    if (!db) return
    
    try {
      setLoadingMetrics(true)
      
      // Load time entries for attendance and latest clock in
      const timeEntriesQuery = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId)
      )
      
      const timeEntriesSnapshot = await getDocs(timeEntriesQuery)
      let entries = timeEntriesSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          clockIn: data.clockIn?.toDate() || null,
          clockOut: data.clockOut?.toDate() || null,
          date: data.date?.toDate() || null,
        }
      }).filter(entry => entry.clockIn !== null)
      
      // Apply period filter
      const now = new Date()
      const currentYear = now.getFullYear()
      
      if (periodFilter === 'this-year') {
        entries = entries.filter(e => {
          const entryDate = e.date || e.clockIn
          return entryDate && entryDate.getFullYear() === currentYear
        })
      } else if (periodFilter === 'last-year') {
        entries = entries.filter(e => {
          const entryDate = e.date || e.clockIn
          return entryDate && entryDate.getFullYear() === currentYear - 1
        })
      }
      // 'all-time' doesn't need filtering
      
      // Apply month filter
      if (monthFilter !== 'all') {
        const monthIndex = parseInt(monthFilter)
        entries = entries.filter(e => {
          const entryDate = e.date || e.clockIn
          return entryDate && entryDate.getMonth() === monthIndex
        })
      }
      
      // Calculate total attendance (unique days with clock in)
      const uniqueDates = new Set(
        entries
          .filter(e => e.date)
          .map(e => format(e.date!, 'yyyy-MM-dd'))
      )
      const totalAttendance = uniqueDates.size
      
      // Get latest clock in time
      const clockInTimes = entries
        .filter(e => e.clockIn)
        .map(e => e.clockIn!)
        .sort((a, b) => b.getTime() - a.getTime()) // Sort descending (most recent first)
      
      const latestClockInTime = clockInTimes.length > 0
        ? format(clockInTimes[0], 'HH:mm')
        : null
      
      // Load completed tasks with date filtering
      let completedTasks = 0
      try {
        const completedTasksList = await getCompletedTasksByUser(userId)
        
        // Filter tasks by period and month
        let filteredTasks = completedTasksList
        
        if (periodFilter === 'this-year') {
          filteredTasks = filteredTasks.filter(task => {
            const completedDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt
            return completedDate && completedDate.getFullYear() === currentYear
          })
        } else if (periodFilter === 'last-year') {
          filteredTasks = filteredTasks.filter(task => {
            const completedDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt
            return completedDate && completedDate.getFullYear() === currentYear - 1
          })
        }
        
        if (monthFilter !== 'all') {
          const monthIndex = parseInt(monthFilter)
          filteredTasks = filteredTasks.filter(task => {
            const completedDate = task.statusHistory?.find(h => h.status === 'Complete')?.timestamp || task.updatedAt
            return completedDate && completedDate.getMonth() === monthIndex
          })
        }
        
        completedTasks = filteredTasks.length
      } catch (error) {
        console.error('Error loading completed tasks:', error)
      }
      
      // Load employee rating (ratings are typically not time-filtered, but we can add it if needed)
      let employeeRating: number | null = null
      try {
        const ratingsQuery = query(
          collection(db, 'ratings'),
          where('employeeId', '==', userId)
        )
        const ratingsSnapshot = await getDocs(ratingsQuery)
        
        if (!ratingsSnapshot.empty) {
          // Calculate average rating from all ratings
          const ratings = ratingsSnapshot.docs.map(doc => {
            const data = doc.data()
            return data.rating || 0
          }).filter(r => r > 0)
          
          if (ratings.length > 0) {
            const sum = ratings.reduce((a, b) => a + b, 0)
            employeeRating = Math.round((sum / ratings.length) * 10) / 10 // Round to 1 decimal
          }
        }
      } catch (error) {
        console.error('Error loading employee rating:', error)
      }
      
      setAttendanceMetrics({
        totalAttendance,
        completedTasks,
        employeeRating,
        latestClockInTime,
      })
    } catch (error) {
      console.error('Error loading attendance metrics:', error)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const handleDownloadInfo = async () => {
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User not authenticated. Please log in to download your profile information.',
      })
      return
    }

    try {
      // Get current form values
      const formValues = form.getValues()
      
      // Get month name for filename
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December']
      const monthName = monthFilter !== 'all' ? monthNames[parseInt(monthFilter)] : 'All'
      const periodName = periodFilter === 'this-year' ? 'This Year' : 
                        periodFilter === 'last-year' ? 'Last Year' : 'All Time'
      
      // Create CSV content
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      // Build CSV rows
      const rows: string[] = []
      
      // Header section
      rows.push('Profile Information Export')
      rows.push(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}`)
      rows.push(`Filter Period: ${periodName}`)
      rows.push(`Filter Month: ${monthName}`)
      rows.push('')
      
      // Personal Information Section
      rows.push('=== PERSONAL INFORMATION ===')
      rows.push('Field,Value')
      rows.push(`Full Name,${escapeCSV(formValues.fullName || 'N/A')}`)
      rows.push(`Preferred Name,${escapeCSV(formValues.preferredName || 'N/A')}`)
      rows.push(`Email Address,${escapeCSV(formValues.email || 'N/A')}`)
      rows.push(`Phone Number,${escapeCSV(formValues.phone || 'N/A')}`)
      rows.push(`Date of Birth,${escapeCSV(formValues.dob ? format(new Date(formValues.dob), 'MMMM dd, yyyy') : 'N/A')}`)
      rows.push(`Job Role/Title,${escapeCSV(formValues.jobRole || 'N/A')}`)
      rows.push(`Work Location,${escapeCSV(formValues.workLocation || 'N/A')}`)
      rows.push(`Gender,${escapeCSV(formValues.gender || 'N/A')}`)
      rows.push(`Employee Type,${escapeCSV(formValues.employeeType || 'N/A')}`)
      rows.push(`Residential Address,${escapeCSV(formValues.residentialAddress || 'N/A')}`)
      rows.push(`Postal Code,${escapeCSV(formValues.postalCode || 'N/A')}`)
      rows.push(`TFN/ABN,${escapeCSV(formValues.tfnAbn || 'N/A')}`)
      rows.push(`ID Number,${escapeCSV(formValues.idNumber || 'N/A')}`)
      rows.push(`Residing in Australia,${escapeCSV(formValues.residingInAu ? 'Yes' : 'No')}`)
      if (formValues.residingInAu) {
        rows.push(`Visa Type,${escapeCSV(formValues.visaType || 'N/A')}`)
        rows.push(`Visa Subclass,${escapeCSV(formValues.visaSubclass || 'N/A')}`)
      }
      rows.push('')
      
      // Emergency Contact Section
      rows.push('=== EMERGENCY CONTACT ===')
      rows.push('Field,Value')
      rows.push(`Full Name,${escapeCSV(formValues.emergency?.fullName || 'N/A')}`)
      rows.push(`Relationship,${escapeCSV(formValues.emergency?.relationship || 'N/A')}`)
      rows.push(`Phone Number,${escapeCSV(formValues.emergency?.phone || 'N/A')}`)
      rows.push('')
      
      // Metrics Section
      rows.push('=== METRICS (Based on Selected Filters) ===')
      rows.push('Metric,Value')
      rows.push(`Total Attendance,${attendanceMetrics.totalAttendance}`)
      rows.push(`Completed Tasks,${attendanceMetrics.completedTasks}`)
      rows.push(`Employee Rating,${attendanceMetrics.employeeRating !== null ? `${attendanceMetrics.employeeRating}/5` : 'N/A'}`)
      rows.push(`Latest Clock In Time,${attendanceMetrics.latestClockInTime || 'N/A'}`)
      rows.push('')
      
      // Document URLs Section
      rows.push('=== DOCUMENT LINKS ===')
      rows.push('Document Type,URL')
      uploadKeys.forEach((key) => {
        const upload = uploads[key]
        if (upload.preview && (upload.preview.startsWith('http://') || upload.preview.startsWith('https://'))) {
          const docName = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()
          rows.push(`${docName},${upload.preview}`)
        }
      })
      
      // Combine all rows
      const csvContent = rows.join('\n')
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      const fileName = `profile-export-${formValues.fullName?.replace(/\s+/g, '-') || 'user'}-${format(new Date(), 'yyyy-MM-dd')}.csv`
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: 'Export successful',
        description: 'Your profile information has been downloaded as CSV',
      })
    } catch (error) {
      console.error('Error exporting profile:', error)
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Failed to export profile information. Please try again.',
      })
    }
  }

  const getUploadState = (key: UploadKey): UploadField => uploads[key]

  const setUploadFile = (key: UploadKey, file: File) => {
    const preview = URL.createObjectURL(file)
    setUploads((prev) => ({ ...prev, [key]: { file, preview } }))
  }

  const setUploadPreview = (key: UploadKey, preview: string) => {
    setUploads((prev) => ({ ...prev, [key]: { ...prev[key], preview } }))
  }

  const removeFile = async (key: UploadKey) => {
    if (!currentUser) return

    try {
      // Remove from Firestore
      const existingProfile = await getDoc(doc(db, 'profiles', currentUser.uid))
      if (existingProfile.exists()) {
        await setDoc(
          doc(db, 'profiles', currentUser.uid),
          {
            [key]: deleteField(), // Remove the field
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      }

      // Clear from state
      setUploads((prev) => ({
        ...prev,
        [key]: { file: null, preview: '' },
      }))

      toast({
        title: 'File removed',
        description: `${key === 'profilePhoto' ? 'Profile picture' : key} has been removed.`,
      })
    } catch (error) {
      console.error(`Error removing ${key}:`, error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to remove file. Please try again.',
      })
    }
  }

  const autoUploadFile = async (key: UploadKey, file: File) => {
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: 'User not authenticated',
        description: 'Please log in to upload files.',
      })
      return
    }

    // Store the current preview to revoke blob URL later
    const currentPreview = uploads[key].preview
    const isBlobUrl = currentPreview.startsWith('blob:')

    // Set uploading state and create preview for the new file
    setUploadingFiles((prev) => ({ ...prev, [key]: true }))
    const preview = URL.createObjectURL(file)
    setUploads((prev) => ({ ...prev, [key]: { file, preview } }))

    try {
      const resourceType: 'image' | 'raw' = key === 'contractDoc' ? 'raw' : 'image'
      // Organize uploads by folder: profile photos go to 'profiles', documents to 'documents'
      const folder = key === 'profilePhoto' 
        ? `profiles/${currentUser.uid}` 
        : key === 'contractDoc' 
        ? `documents/${currentUser.uid}`
        : `profiles/${currentUser.uid}/documents`
      
      // Upload to Cloudinary
      const url = await uploadToCloudinary(file, resourceType, folder)
      
      // Save to Firestore immediately
      const existingProfile = await getDoc(doc(db, 'profiles', currentUser.uid))
      const existingData = existingProfile.exists() ? existingProfile.data() : {}
      
      await setDoc(
        doc(db, 'profiles', currentUser.uid),
        {
          ...existingData,
          [key]: url,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      // Update state with Cloudinary URL and clear file
      setUploads((prev) => ({
        ...prev,
        [key]: { file: null, preview: url },
      }))

      // Revoke blob URLs
      if (isBlobUrl) {
        URL.revokeObjectURL(currentPreview)
      }
      URL.revokeObjectURL(preview)

      toast({
        title: 'File uploaded successfully',
        description: `${key === 'profilePhoto' ? 'Profile picture' : key} has been saved.`,
      })
    } catch (error) {
      console.error(`Error auto-uploading ${key}:`, error)
      
      // Extract error message more robustly
      let errorMessage = 'Upload failed. Please try again.'
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as any).message) || errorMessage
      }
      
      // If error message is still generic, try to get more details
      if (errorMessage === 'Upload failed. Please try again.' || !errorMessage.trim()) {
        if (error && typeof error === 'object') {
          const errorStr = JSON.stringify(error, null, 2)
          console.error('Full error object:', errorStr)
          // Try to extract meaningful info from error object
          if ('error' in error && typeof (error as any).error === 'object') {
            const innerError = (error as any).error
            if (innerError.message) {
              errorMessage = innerError.message
            } else if (innerError.error) {
              errorMessage = innerError.error
            }
          }
        }
      }
      
      console.error('Full error details:', {
        key,
        error,
        errorMessage,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
        hasCloudName: !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        hasUploadPreset: !!process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      })
      
      toast({
        variant: 'destructive',
        title: `Failed to upload ${key === 'profilePhoto' ? 'profile picture' : key}`,
        description: errorMessage || 'Please check the browser console for more details.',
      })
      // Keep the file in state so user can try again, but revoke the preview blob URL
      URL.revokeObjectURL(preview)
      // Restore previous preview if it was a saved URL
      if (isBlobUrl && currentPreview) {
        // If there was a previous blob URL, we already revoked it, so clear preview
        setUploads((prev) => ({
          ...prev,
          [key]: { ...prev[key], preview: '' },
        }))
      } else if (!isBlobUrl && currentPreview) {
        // Restore the previous saved URL
        setUploads((prev) => ({
          ...prev,
          [key]: { ...prev[key], preview: currentPreview },
        }))
      }
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [key]: false }))
    }
  }

  const uploadToCloudinary = async (file: File, resourceType: 'image' | 'raw', folder?: string): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'www-dashboard'

    // Detailed configuration check
    if (!cloudName) {
      const errorMsg = 'Cloudinary cloud name is not configured. Please add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME to your .env.local file and restart the server.'
      console.error('Cloudinary configuration missing:', {
        cloudName: 'MISSING',
        uploadPreset: uploadPreset || 'MISSING',
        allEnvVars: Object.keys(process.env).filter(k => k.includes('CLOUDINARY')),
      })
      throw new Error(errorMsg)
    }

    if (!uploadPreset) {
      const errorMsg = 'Cloudinary upload preset is not configured. Please add NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to your .env.local file and restart the server.'
      console.error('Cloudinary configuration missing:', {
        cloudName: cloudName || 'MISSING',
        uploadPreset: 'MISSING',
        allEnvVars: Object.keys(process.env).filter(k => k.includes('CLOUDINARY')),
      })
      throw new Error(errorMsg)
    }

    // Log configuration for debugging (without sensitive data)
    console.log('Uploading to Cloudinary:', {
      cloudName,
      uploadPreset,
      resourceType,
      folder,
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      fileType: file.type,
    })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    
    // Add resource_type to formData (required for raw files to avoid 401 errors)
    if (resourceType === 'raw') {
      formData.append('resource_type', 'raw')
    }
    
    // Add folder if specified
    if (folder) {
      formData.append('folder', folder)
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
    console.log('Upload URL:', uploadUrl)

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      console.log('Cloudinary response status:', response.status, response.statusText)

      if (!response.ok) {
        let errorMessage = `Failed to upload ${resourceType === 'image' ? 'image' : 'file'}`
        let errorDetails: any = null
        
        try {
          const errorData = await response.json()
          errorDetails = errorData
          errorMessage = errorData.error?.message || errorData.message || errorMessage
          
          // Provide more specific error messages
          if (errorData.error) {
            if (errorData.error.message?.includes('Invalid preset') || errorData.error.message?.includes('not found')) {
              errorMessage = `Upload preset "${uploadPreset}" not found. Please create it in Cloudinary Dashboard → Settings → Upload → Upload presets. Set it to "Unsigned" mode and allow image/PDF formats.`
            } else if (errorData.error.message?.includes('File size too large')) {
              errorMessage = `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds the maximum allowed size. Please use a smaller file.`
            } else if (errorData.error.message?.includes('Invalid image file')) {
              errorMessage = `Invalid file type. Please ensure the file is a valid ${resourceType === 'image' ? 'image' : 'document'}.`
            }
          }
          
          console.error('Cloudinary upload error details:', errorData)
        } catch (e) {
          // If response is not JSON, try to get text
          try {
            const text = await response.text()
            errorMessage = text || errorMessage
            console.error('Cloudinary upload error (text):', text)
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}. Please check your Cloudinary configuration.`
            console.error('Cloudinary upload error (status):', errorMessage)
          }
        }
        
        // Include more context in the error
        const fullErrorMessage = `${errorMessage} (Status: ${response.status})`
        throw new Error(fullErrorMessage)
      }

      const data = await response.json()
      console.log('Cloudinary upload success:', { url: data.secure_url, public_id: data.public_id })
      
      if (!data.secure_url) {
        console.error('Cloudinary response missing secure_url:', data)
        throw new Error('Upload succeeded but no URL returned from Cloudinary')
      }

      return data.secure_url
    } catch (error) {
      console.error('Cloudinary upload exception:', error)
      if (error instanceof Error) {
        // Re-throw with more context if it's a network error
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Unable to connect to Cloudinary. Please check your internet connection and try again.')
        }
        throw error
      }
      throw new Error('Unknown error occurred during upload')
    }
  }

  const onSubmit = async (values: FormDataType) => {
    if (!currentUser) {
      toast({ 
        variant: 'destructive', 
        title: 'User not authenticated',
        description: 'Please log in to save your profile.'
      })
      return
    }

    setLoading(true)
    try {
      const fileUrls: Partial<Record<UploadKey, string>> = {}
      const oldPreviewsToRevoke: string[] = []

      for (const key of uploadKeys) {
        const u = getUploadState(key)
        if (u.file) {
          const resourceType: 'image' | 'raw' = key === 'contractDoc' ? 'raw' : 'image'
          // Organize uploads by folder: profile photos go to 'profiles', documents to 'documents'
          const folder = key === 'profilePhoto' 
            ? `profiles/${currentUser.uid}` 
            : key === 'contractDoc' 
            ? `documents/${currentUser.uid}`
            : `profiles/${currentUser.uid}/documents`
          
          try {
            const url = await uploadToCloudinary(u.file, resourceType, folder)
            fileUrls[key] = url
            if (u.preview.startsWith('blob:')) {
              oldPreviewsToRevoke.push(u.preview)
            }
          } catch (error) {
            console.error(`Error uploading ${key}:`, error)
            toast({
              variant: 'destructive',
              title: `Failed to upload ${key === 'profilePhoto' ? 'profile picture' : key}`,
              description: error instanceof Error ? error.message : 'Upload failed. Please try again.',
            })
            // If upload fails, preserve existing saved URL if it's HTTP/HTTPS
            // Don't save blob URLs - they're temporary and won't persist
            // The file will remain in state so user can try uploading again
            if (u.preview && (u.preview.startsWith('http://') || u.preview.startsWith('https://'))) {
              fileUrls[key] = u.preview
            }
            continue
          }
        } else if (u.preview && (u.preview.startsWith('http://') || u.preview.startsWith('https://'))) {
          // Only save HTTP/HTTPS URLs (Cloudinary URLs), not blob URLs
          // Blob URLs are temporary and will break after page reload
          fileUrls[key] = u.preview
        }
      }

      // Revoke old blob URLs
      oldPreviewsToRevoke.forEach(URL.revokeObjectURL)

      // Helper function to remove empty strings and undefined values
      const cleanData = (obj: any): any => {
        const cleaned: any = {}
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
              const cleanedNested = cleanData(value)
              if (Object.keys(cleanedNested).length > 0) {
                cleaned[key] = cleanedNested
              }
            } else {
              cleaned[key] = value
            }
          }
        }
        return cleaned
      }

      // Don't include email in the update - it should remain unchanged
      const { email, ...valuesWithoutEmail } = values
      
      // Clean the form values to remove empty strings
      const cleanedValues = cleanData(valuesWithoutEmail)
      
      // Get existing profile data to preserve file URLs if uploads fail
      const existingProfile = await getDoc(doc(db, 'profiles', currentUser.uid))
      const existingData = existingProfile.exists() ? (existingProfile.data() as Partial<FullDataType>) : null
      
      // For any upload keys that don't have a URL (upload failed or no file),
      // preserve the existing saved URL if it exists
      uploadKeys.forEach((key) => {
        if (!fileUrls[key] && existingData?.[key] && typeof existingData[key] === 'string') {
          const existingUrl = existingData[key] as string
          // Only preserve HTTP/HTTPS URLs, not blob URLs
          if (existingUrl.startsWith('http://') || existingUrl.startsWith('https://')) {
            fileUrls[key] = existingUrl
          }
        }
      })
      
      const fullData: FullDataType = {
        ...cleanedValues,
        ...fileUrls,
        updatedAt: new Date().toISOString(),
      }

      // Only update email if it doesn't exist in the profile yet (for migration purposes)
      // Otherwise, preserve the existing email or use the Firebase Auth email
      if (existingData) {
        if (existingData.email) {
          fullData.email = existingData.email
        } else if (currentUser.email) {
          fullData.email = currentUser.email
        }
      } else if (currentUser.email) {
        fullData.email = currentUser.email
      }

      await setDoc(doc(db, 'profiles', currentUser.uid), fullData, { merge: true })

      // Check if profile photo was uploaded (before clearing the file)
      const profilePhotoUploaded = fileUrls.profilePhoto && uploads.profilePhoto.file !== null

      // Update local state - only update previews for successfully uploaded files
      Object.entries(fileUrls).forEach(([key, url]) => {
        setUploadPreview(key as UploadKey, url)
      })

      // Only clear files that were successfully uploaded (exist in fileUrls)
      // Keep files that failed to upload so user can try again
      setUploads((prev) => {
        const updated = { ...prev }
        uploadKeys.forEach((key) => {
          if (fileUrls[key]) {
            // File was successfully uploaded or has a valid saved URL
            updated[key] = { ...prev[key], file: null }
          }
          // If fileUrls[key] doesn't exist, keep the file in state
        })
        return updated
      })
      
      toast({ 
        title: 'Profile saved successfully', 
        description: profilePhotoUploaded 
          ? 'Your profile picture has been uploaded to Cloudinary and saved. All changes have been saved.'
          : 'Your changes have been saved. You can continue editing and save again anytime.'
      })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({ 
        variant: 'destructive', 
        title: 'Error saving profile',
        description: 'There was an error saving your profile. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const renderPreview = (key: UploadKey) => {
    const { preview } = getUploadState(key)
    const isPdf = key === 'contractDoc'
    const isProfile = key === 'profilePhoto'
    const baseImgClass = isProfile
      ? 'w-40 h-40 rounded-full object-cover border-2 border-border'
      : 'w-full h-60 rounded-lg object-cover border-2 border-border shadow-sm'

    const handleUploadClick = () => triggerUpload(key)

    if (isPdf) {
      if (preview) {
        return (
          <div className="mt-2 space-y-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleUploadClick}
              className="w-fit px-10 py-2 mr-3"
            >
              Change File
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(preview, '_blank')}
              className="w-fit px-10 py-2"
            >
              View File
            </Button>
          </div>
        )
      } else {
        return (
          <div className="mt-2">
            <Button
              size="sm"
              onClick={handleUploadClick}
              className="w-fit px-10 py-2"
            >
              Upload File
            </Button>
          </div>
        )
      }
    }

    // For images
    if (preview) {
      return (
        <div className="mt-2 flex justify-start">
          <img
            src={preview}
            alt={`${key} preview`}
            className={`${baseImgClass} cursor-pointer hover:opacity-80`}
            onClick={handleUploadClick}
          />
        </div>
      )
    } else {
      const placeholderClass = isProfile
        ? 'w-40 h-40 rounded-full border-2 border-dashed border-input bg-muted flex flex-col items-center justify-center cursor-pointer hover:border-primary'
        : 'w-full h-60 rounded-lg border-2 border-dashed border-input bg-muted flex flex-col items-center justify-center cursor-pointer hover:border-primary'
      return (
        <div className={placeholderClass} onClick={handleUploadClick}>
          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Click to upload</p>
        </div>
      )
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const profilePhotoPreview = getUploadState('profilePhoto').preview

  return (
    <div className="space-y-6">
      {/* Employee Detail Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-1 w-1 bg-green-500 rounded-full"></div>
              <CardTitle className="text-2xl">Profile Details</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <Select value={periodFilter} onValueChange={(value) => setPeriodFilter(value as 'this-year' | 'last-year' | 'all-time')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="all-time">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  <SelectItem value="0">January</SelectItem>
                  <SelectItem value="1">February</SelectItem>
                  <SelectItem value="2">March</SelectItem>
                  <SelectItem value="3">April</SelectItem>
                  <SelectItem value="4">May</SelectItem>
                  <SelectItem value="5">June</SelectItem>
                  <SelectItem value="6">July</SelectItem>
                  <SelectItem value="7">August</SelectItem>
                  <SelectItem value="8">September</SelectItem>
                  <SelectItem value="9">October</SelectItem>
                  <SelectItem value="10">November</SelectItem>
                  <SelectItem value="11">December</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleDownloadInfo}
                disabled={loading || loadingMetrics}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Info
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Profile Picture with Edit Icon */}
            <div className="relative group">
              <div className="relative">
                {profilePhotoPreview ? (
                  <img
                    src={profilePhotoPreview}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-border"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-muted border-4 border-border flex items-center justify-center">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => triggerUpload('profilePhoto')}
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary/90 transition-colors"
                  title="Edit profile picture"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <input
                id="profile-photo"
                ref={(el) => { fileInputRefs.current['profilePhoto'] = el }}
                type="file"
                accept="image/*"
                style={{ display: 'none' } as React.CSSProperties}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // Create a preview URL for cropping
                    const reader = new FileReader()
                    reader.onload = () => {
                      setImageToCrop(reader.result as string)
                      setCropDialogOpen(true)
                    }
                    reader.readAsDataURL(file)
                    e.target.value = ''
                  }
                }}
              />
              <ImageCropDialog
                open={cropDialogOpen}
                onOpenChange={(open) => {
                  setCropDialogOpen(open)
                  if (!open) {
                    // Clean up when dialog closes
                    setImageToCrop(null)
                  }
                }}
                imageSrc={imageToCrop || ''}
                onCropComplete={(croppedFile) => {
                  setImageToCrop(null)
                  // Auto-upload the cropped profile photo
                  autoUploadFile('profilePhoto', croppedFile)
                }}
                aspectRatio={1}
              />
            </div>

            {/* Employee Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-3xl font-bold">
                  {form.watch('fullName') || form.watch('preferredName') || authUser?.name || 'Employee Name'}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Role</p>
                  <p className="font-medium">{form.watch('jobRole') || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone Number</p>
                  <p className="font-medium">{form.watch('phone') || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                  <p className="font-medium">{form.watch('email') || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isBusy"
                    checked={form.watch('isBusy') || false}
                    onCheckedChange={(checked) => {
                      form.setValue('isBusy', checked, { shouldDirty: true });
                      // Auto-save busy status immediately
                      if (currentUser) {
                        setDoc(doc(db, 'profiles', currentUser.uid), {
                          isBusy: checked,
                          updatedAt: new Date().toISOString(),
                        }, { merge: true }).catch((error) => {
                          console.error('Error saving busy status:', error);
                        });
                      }
                    }}
                  />
                  <Label htmlFor="isBusy" className="text-sm font-medium cursor-pointer">
                    Mark as Busy
                  </Label>
                </div>
                {form.watch('isBusy') && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Busy
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <Card className="bg-muted/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <ArrowRight className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{attendanceMetrics.totalAttendance}</p>
                    <p className="text-sm text-muted-foreground">Total Attendance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <CheckSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{attendanceMetrics.completedTasks}</p>
                    <p className="text-sm text-muted-foreground">Completed Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Star className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {attendanceMetrics.employeeRating !== null 
                        ? `${attendanceMetrics.employeeRating}/5` 
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">Employee Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {attendanceMetrics.latestClockInTime || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">Latest Clock In Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Completion Progress */}
          <div className="mt-8 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Profile Completion</span>
                <Badge variant={profileProgress === 100 ? "default" : "secondary"} className="ml-2">
                  {profileProgress}%
                </Badge>
              </div>
              {profileProgress < 100 && (
                <span className="text-xs text-muted-foreground">
                  Complete all sections to finish your profile
                </span>
              )}
            </div>
            <Progress value={profileProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Tabs defaultValue="personal-info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal-info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document Upload
            </TabsTrigger>
            <TabsTrigger value="emergency" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Emergency Contact
            </TabsTrigger>
            <TabsTrigger value="declaration" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Declaration
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal-info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-4 md:space-y-0">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" {...form.register('fullName')} />
                  {form.formState.errors.fullName && <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredName">Preferred Name</Label>
                  <Input id="preferredName" {...form.register('preferredName')} />
                  {form.formState.errors.preferredName && <p className="text-sm text-destructive">{form.formState.errors.preferredName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    {...form.register('email')} 
                    disabled 
                    className="bg-muted cursor-not-allowed opacity-60"
                  />
                  {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                  <p className="text-xs text-muted-foreground">Email address cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <PhoneInput
                    id="phone"
                    value={form.watch('phone') || ''}
                    onChange={(value) => form.setValue('phone', value, { shouldDirty: true })}
                    defaultCountry="+61"
                  />
                  {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <div className="flex gap-2">
                    <Input
                      id="dob"
                      type="date"
                      {...form.register('dob', {
                        onChange: (e) => {
                          const dateValue = e.target.value
                          if (dateValue) {
                            const date = new Date(dateValue)
                            if (!isNaN(date.getTime())) {
                              setDobDate(date)
                            }
                          } else {
                            setDobDate(undefined)
                          }
                        }
                      })}
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dobDate}
                          onSelect={(date) => {
                            if (date) {
                              setDobDate(date)
                              form.setValue('dob', format(date, 'yyyy-MM-dd'), { shouldDirty: true })
                            }
                          }}
                          initialFocus
                          disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {form.formState.errors.dob && <p className="text-sm text-destructive">{form.formState.errors.dob.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobRole">Job Role/Title</Label>
                  <Input id="jobRole" {...form.register('jobRole')} />
                  {form.formState.errors.jobRole && <p className="text-sm text-destructive">{form.formState.errors.jobRole.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workLocation">Work Location</Label>
                  <Select onValueChange={(v) => form.setValue('workLocation', v as "Sri Lanka" | "Australia")} value={form.watch('workLocation')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select onValueChange={(v) => form.setValue('gender', v as "Male" | "Female" | "Prefer not to say")} value={form.watch('gender')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentialAddress">Residential Address</Label>
                  <Input id="residentialAddress" {...form.register('residentialAddress')} />
                  {form.formState.errors.residentialAddress && <p className="text-sm text-destructive">{form.formState.errors.residentialAddress.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" {...form.register('postalCode')} />
                  {form.formState.errors.postalCode && <p className="text-sm text-destructive">{form.formState.errors.postalCode.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeType">Employee Type</Label>
                  <Select onValueChange={(v) => form.setValue('employeeType', v as "Subcontractor" | "Full-time" | "Part-time" | "Intern (Trainee)")} value={form.watch('employeeType')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                      <SelectItem value="Full-time">Full-time</SelectItem>
                      <SelectItem value="Part-time">Part-time</SelectItem>
                      <SelectItem value="Intern (Trainee)">Intern (Trainee)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tfnAbn">TFN (Tax File Number) or ABN (Australian Business Number)</Label>
                  <Input id="tfnAbn" {...form.register('tfnAbn')} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Upload Tab */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Uploads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="idNumber">Sri Lankan NIC number / Driver License number or Australian Driver License Number</Label>
                  <Input id="idNumber" {...form.register('idNumber')} />
                  {form.formState.errors.idNumber && <p className="text-sm text-destructive">{form.formState.errors.idNumber.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DragDropFileUpload
                    label="Front photo of your Sri Lankan NIC / Driver license or Australian driver license"
                    accept="image/*"
                    maxSize={50}
                    fileTypes="JPEG, PNG, JPG"
                    value={uploads.idFrontPhoto.file}
                    preview={uploads.idFrontPhoto.preview}
                    onChange={(file) => {
                      if (file) {
                        autoUploadFile('idFrontPhoto', file)
                      } else {
                        // If there's a saved preview URL, remove it from Firestore
                        if (uploads.idFrontPhoto.preview && (uploads.idFrontPhoto.preview.startsWith('http://') || uploads.idFrontPhoto.preview.startsWith('https://'))) {
                          removeFile('idFrontPhoto')
                        } else {
                          setUploads((prev) => ({
                            ...prev,
                            idFrontPhoto: { file: null, preview: '' },
                          }))
                        }
                      }
                    }}
                    disabled={loading || uploadingFiles.idFrontPhoto}
                  />
                  <DragDropFileUpload
                    label="Back photo of your Sri Lankan NIC / driver license or Australian driver license"
                    accept="image/*"
                    maxSize={50}
                    fileTypes="JPEG, PNG, JPG"
                    value={uploads.idBackPhoto.file}
                    preview={uploads.idBackPhoto.preview}
                    onChange={(file) => {
                      if (file) {
                        autoUploadFile('idBackPhoto', file)
                      } else {
                        if (uploads.idBackPhoto.preview && (uploads.idBackPhoto.preview.startsWith('http://') || uploads.idBackPhoto.preview.startsWith('https://'))) {
                          removeFile('idBackPhoto')
                        } else {
                          setUploads((prev) => ({
                            ...prev,
                            idBackPhoto: { file: null, preview: '' },
                          }))
                        }
                      }
                    }}
                    disabled={loading || uploadingFiles.idBackPhoto}
                  />
                  <DragDropFileUpload
                    label="Clear photo of yourself with a white background to use as the company ID"
                    accept="image/*"
                    maxSize={50}
                    fileTypes="JPEG, PNG, JPG"
                    value={uploads.selfiePhoto.file}
                    preview={uploads.selfiePhoto.preview}
                    onChange={(file) => {
                      if (file) {
                        autoUploadFile('selfiePhoto', file)
                      } else {
                        if (uploads.selfiePhoto.preview && (uploads.selfiePhoto.preview.startsWith('http://') || uploads.selfiePhoto.preview.startsWith('https://'))) {
                          removeFile('selfiePhoto')
                        } else {
                          setUploads((prev) => ({
                            ...prev,
                            selfiePhoto: { file: null, preview: '' },
                          }))
                        }
                      }
                    }}
                    disabled={loading || uploadingFiles.selfiePhoto}
                  />
                  <DragDropFileUpload
                    label="A photo of your passport detail page"
                    accept="image/*"
                    maxSize={50}
                    fileTypes="JPEG, PNG, JPG"
                    value={uploads.passportPhoto.file}
                    preview={uploads.passportPhoto.preview}
                    onChange={(file) => {
                      if (file) {
                        autoUploadFile('passportPhoto', file)
                      } else {
                        if (uploads.passportPhoto.preview && (uploads.passportPhoto.preview.startsWith('http://') || uploads.passportPhoto.preview.startsWith('https://'))) {
                          removeFile('passportPhoto')
                        } else {
                          setUploads((prev) => ({
                            ...prev,
                            passportPhoto: { file: null, preview: '' },
                          }))
                        }
                      }
                    }}
                    disabled={loading || uploadingFiles.passportPhoto}
                  />
                  <div className="md:col-span-2">
                    <DragDropFileUpload
                      label="Contract Document (As PDF)"
                      accept=".pdf,application/pdf"
                      maxSize={50}
                      fileTypes="PDF"
                      value={uploads.contractDoc.file}
                      preview={uploads.contractDoc.preview}
                      onChange={(file) => {
                        if (file) {
                          autoUploadFile('contractDoc', file)
                        } else {
                          if (uploads.contractDoc.preview && (uploads.contractDoc.preview.startsWith('http://') || uploads.contractDoc.preview.startsWith('https://'))) {
                            removeFile('contractDoc')
                          } else {
                            setUploads((prev) => ({
                              ...prev,
                              contractDoc: { file: null, preview: '' },
                            }))
                          }
                        }
                      }}
                      disabled={loading || uploadingFiles.contractDoc}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <Checkbox
                      id="residingInAu"
                      checked={residingInAu}
                      onCheckedChange={(checked) => form.setValue('residingInAu', !!checked)}
                    />
                    <span className='font-bold'>Currently residing in Australia</span>
                  </Label>
                </div>
                {residingInAu && (
                  <div className="ml-4 sm:ml-6 space-y-4 p-4 border-l-2 border-accent">
                    <div className="space-y-2">
                      <Label htmlFor="visaType">Visa Type</Label>
                      <Input id="visaType" {...form.register('visaType')} />
                      {form.formState.errors.visaType && <p className="text-sm text-destructive">{form.formState.errors.visaType.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="visaSubclass">Visa Subclass</Label>
                      <Input id="visaSubclass" {...form.register('visaSubclass')} />
                      {form.formState.errors.visaSubclass && <p className="text-sm text-destructive">{form.formState.errors.visaSubclass.message}</p>}
                    </div>
                    <DragDropFileUpload
                      label="A copy of your visa grant notice (Image)"
                      accept="image/*"
                      maxSize={50}
                      fileTypes="JPEG, PNG, JPG"
                      value={uploads.visaNotice.file}
                      preview={uploads.visaNotice.preview}
                      onChange={(file) => {
                        if (file) {
                          autoUploadFile('visaNotice', file)
                        } else {
                          if (uploads.visaNotice.preview && (uploads.visaNotice.preview.startsWith('http://') || uploads.visaNotice.preview.startsWith('https://'))) {
                            removeFile('visaNotice')
                          } else {
                            setUploads((prev) => ({
                              ...prev,
                              visaNotice: { file: null, preview: '' },
                            }))
                          }
                        }
                      }}
                      disabled={loading || uploadingFiles.visaNotice}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Emergency Contact Tab */}
          <TabsContent value="emergency" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency-fullName">Full Name</Label>
                  <Input id="emergency-fullName" {...form.register('emergency.fullName')} />
                  {form.formState.errors.emergency?.fullName && <p className="text-sm text-destructive">{form.formState.errors.emergency.fullName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-relationship">Relationship</Label>
                  <Input id="emergency-relationship" {...form.register('emergency.relationship')} />
                  {form.formState.errors.emergency?.relationship && <p className="text-sm text-destructive">{form.formState.errors.emergency.relationship.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency-phone">Contact Number</Label>
                  <PhoneInput
                    id="emergency-phone"
                    value={form.watch('emergency.phone') || ''}
                    onChange={(value) => form.setValue('emergency.phone', value, { shouldDirty: true })}
                    defaultCountry="+61"
                  />
                  {form.formState.errors.emergency?.phone && <p className="text-sm text-destructive">{form.formState.errors.emergency.phone.message}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Declaration Tab */}
          <TabsContent value="declaration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Declaration and Consent</CardTitle>
                <CardDescription>Please review and accept the following.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="declaration1"
                    checked={form.watch('declaration1')}
                    onCheckedChange={(checked) => form.setValue('declaration1', !!checked)}
                  />
                  <Label htmlFor="declaration1" className="text-sm leading-none">
                    I declare that the information I have provided is accurate and true to the best of my knowledge.
                  </Label>
                </div>
                {form.formState.errors.declaration1 && <p className="text-sm text-destructive">{form.formState.errors.declaration1.message}</p>}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="declaration2"
                    checked={form.watch('declaration2')}
                    onCheckedChange={(checked) => form.setValue('declaration2', !!checked)}
                  />
                  <Label htmlFor="declaration2" className="text-sm leading-none">
                    I consent to WE WILL AUSTRALIA storing and using my information for internal purposes.
                  </Label>
                </div>
                {form.formState.errors.declaration2 && <p className="text-sm text-destructive">{form.formState.errors.declaration2.message}</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <CardFooter className="flex justify-start">
          <Button 
            type="submit" 
            disabled={loading || (!form.formState.isDirty && !uploadKeys.some(key => uploads[key].file !== null))}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardFooter>
      </form>
    </div>
  )
}

export default Profile