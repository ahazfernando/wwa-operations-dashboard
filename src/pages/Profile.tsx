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
import {
  initializeApp,
  getApps,
} from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { Upload } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const FormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  preferredName: z.string().min(1, "Preferred name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  dob: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid date format"),
  jobRole: z.string().min(1, "Job role is required"),
  workLocation: z.enum(["Sri Lanka", "Australia"]),
  residentialAddress: z.string().min(1, "Residential address is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  gender: z.enum(["Male", "Female", "Prefer not to say"]),
  employeeType: z.enum(["Subcontractor", "Full-time", "Part-time", "Intern (Trainee)"]),
  tfnAbn: z.string().optional(),
  idNumber: z.string().min(1, "ID number is required"),
  residingInAu: z.boolean(),
  visaType: z.string(),
  visaSubclass: z.string(),
  emergency: z.object({
    fullName: z.string().min(1, "Emergency contact full name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(1, "Emergency contact phone is required"),
  }),
  declaration1: z.boolean().refine(val => val === true, "You must declare that the information is accurate and true."),
  declaration2: z.boolean().refine(val => val === true, "You must consent to WE WILL AUSTRALIA storing and using your information."),
}).superRefine((data, ctx) => {
  if (data.residingInAu) {
    if (!data.visaType.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visa type is required",
        path: ["visaType"],
      });
    }
    if (!data.visaSubclass.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visa subclass is required",
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
  const [currentUser, setCurrentUser] = useState<User | null>(null)

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        setLoading(true)
        try {
          const docSnap = await getDoc(doc(db, 'profiles', user.uid))
          if (docSnap.exists()) {
            const data = docSnap.data() as Partial<FullDataType>
            // Set form values
            Object.entries(data).forEach(([key, value]) => {
              if (key === 'dob' && value) {
                const date = new Date(value as string)
                if (!isNaN(date.getTime())) {
                  form.setValue('dob' as const, format(date, 'yyyy-MM-dd'))
                }
                return
              }
              if (key === 'emergency') {
                const em = value as Partial<FormDataType['emergency']> || {}
                form.setValue('emergency.fullName' as const, em.fullName || '')
                form.setValue('emergency.relationship' as const, em.relationship || '')
                form.setValue('emergency.phone' as const, em.phone || '')
                return
              }
              const scalarKeys: (keyof FormDataType)[] = [
                'fullName', 'preferredName', 'email', 'phone', 'jobRole', 'workLocation',
                'residentialAddress', 'postalCode', 'gender', 'employeeType', 'tfnAbn',
                'idNumber', 'residingInAu', 'visaType', 'visaSubclass', 'declaration1', 'declaration2'
              ]
              if (scalarKeys.includes(key as keyof FormDataType)) {
                form.setValue(key as keyof FormDataType, value as FormDataType[keyof FormDataType])
                return
              }
            })
            // Set upload previews
            uploadKeys.forEach((key) => {
              if (data[key]) {
                setUploads((prev) => ({ ...prev, [key]: { ...prev[key], preview: data[key] as string } }))
              }
            })
          }
        } catch (error) {
          console.error('Error loading profile:', error)
          toast({ variant: 'destructive', title: 'Error loading profile' })
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })
    return unsubscribe
  }, [auth, db, form, toast])

  const getUploadState = (key: UploadKey): UploadField => uploads[key]

  const setUploadFile = (key: UploadKey, file: File) => {
    const preview = URL.createObjectURL(file)
    setUploads((prev) => ({ ...prev, [key]: { file, preview } }))
  }

  const setUploadPreview = (key: UploadKey, preview: string) => {
    setUploads((prev) => ({ ...prev, [key]: { ...prev[key], preview } }))
  }

  const uploadToCloudinary = async (file: File, resourceType: 'image' | 'raw'): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!}/${resourceType}/upload`,
      { method: 'POST', body: formData }
    )

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const data = await response.json()
    return data.secure_url
  }

  const onSubmit = async (values: FormDataType) => {
    if (!currentUser) {
      toast({ variant: 'destructive', title: 'User not authenticated' })
      return
    }

    // Check required uploads
    const requiredUploads: UploadKey[] = ['idFrontPhoto', 'idBackPhoto', 'selfiePhoto']
    for (const key of requiredUploads) {
      const u = getUploadState(key)
      if (!u.preview) {
        toast({ variant: 'destructive', title: `Please upload ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}` })
        return
      }
    }

    setLoading(true)
    try {
      const fileUrls: Partial<Record<UploadKey, string>> = {}
      const oldPreviewsToRevoke: string[] = []

      for (const key of uploadKeys) {
        const u = getUploadState(key)
        if (u.file) {
          const resourceType: 'image' | 'raw' = key === 'contractDoc' ? 'raw' : 'image'
          const url = await uploadToCloudinary(u.file, resourceType)
          fileUrls[key] = url
          if (u.preview.startsWith('blob:')) {
            oldPreviewsToRevoke.push(u.preview)
          }
        } else if (u.preview) {
          fileUrls[key] = u.preview
        }
      }

      // Revoke old blob URLs
      oldPreviewsToRevoke.forEach(URL.revokeObjectURL)

      const fullData: FullDataType = {
        ...values,
        ...fileUrls,
        updatedAt: new Date().toISOString(),
      }

      await setDoc(doc(db, 'profiles', currentUser.uid), fullData)

      // Update local state
      Object.entries(fileUrls).forEach(([key, url]) => {
        setUploadPreview(key as UploadKey, url)
      })

      setUploads((prev) => ({
        profilePhoto: { ...prev.profilePhoto, file: null },
        idFrontPhoto: { ...prev.idFrontPhoto, file: null },
        idBackPhoto: { ...prev.idBackPhoto, file: null },
        selfiePhoto: { ...prev.selfiePhoto, file: null },
        passportPhoto: { ...prev.passportPhoto, file: null },
        contractDoc: { ...prev.contractDoc, file: null },
        visaNotice: { ...prev.visaNotice, file: null },
      }))

      toast({ title: 'Profile updated successfully' })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({ variant: 'destructive', title: 'Error saving profile' })
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

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input
                id="profile-photo"
                ref={(el) => { fileInputRefs.current['profilePhoto'] = el }}
                type="file"
                accept="image/*"
                style={{ display: 'none' } as React.CSSProperties}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadFile('profilePhoto', file)
                    e.target.value = ''
                  }
                }}
              />
              {renderPreview('profilePhoto')}
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
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
              <Input id="email" type="email" {...form.register('email')} />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...form.register('phone')} />
              {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" {...form.register('dob')} />
              {form.formState.errors.dob && <p className="text-sm text-destructive">{form.formState.errors.dob.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobRole">Job Role/Title</Label>
              <Input id="jobRole" {...form.register('jobRole')} />
              {form.formState.errors.jobRole && <p className="text-sm text-destructive">{form.formState.errors.jobRole.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="workLocation">Work Location</Label>
              <Select onValueChange={(v) => form.setValue('workLocation', v as "Sri Lanka" | "Australia")} defaultValue={form.watch('workLocation')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select onValueChange={(v) => form.setValue('gender', v as "Male" | "Female" | "Prefer not to say")} defaultValue={form.watch('gender')}>
                <SelectTrigger>
                  <SelectValue />
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
              <Select onValueChange={(v) => form.setValue('employeeType', v as "Subcontractor" | "Full-time" | "Part-time" | "Intern (Trainee)")} defaultValue={form.watch('employeeType')}>
                <SelectTrigger>
                  <SelectValue />
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

        {/* Document Uploads */}
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
              <div className="space-y-2">
                <Label htmlFor="id-front">Front photo of your Sri Lankan NIC / Driver license or Australian driver license</Label>
                <input
                  id="id-front"
                  ref={(el) => { fileInputRefs.current['idFrontPhoto'] = el }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' } as React.CSSProperties}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadFile('idFrontPhoto', file)
                      e.target.value = ''
                    }
                  }}
                />
                {renderPreview('idFrontPhoto')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="id-back">Back photo of your Sri Lankan NIC / driver license or Australian driver license</Label>
                <input
                  id="id-back"
                  ref={(el) => { fileInputRefs.current['idBackPhoto'] = el }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' } as React.CSSProperties}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadFile('idBackPhoto', file)
                      e.target.value = ''
                    }
                  }}
                />
                {renderPreview('idBackPhoto')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="selfie">Clear photo of yourself with a white background to use as the company ID</Label>
                <input
                  id="selfie"
                  ref={(el) => { fileInputRefs.current['selfiePhoto'] = el }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' } as React.CSSProperties}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadFile('selfiePhoto', file)
                      e.target.value = ''
                    }
                  }}
                />
                {renderPreview('selfiePhoto')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="passport">A photo of your passport detail page</Label>
                <input
                  id="passport"
                  ref={(el) => { fileInputRefs.current['passportPhoto'] = el }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' } as React.CSSProperties}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadFile('passportPhoto', file)
                      e.target.value = ''
                    }
                  }}
                />
                {renderPreview('passportPhoto')}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contract">Contract Document (As PDF)</Label>
                <input
                  id="contract"
                  ref={(el) => { fileInputRefs.current['contractDoc'] = el }}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' } as React.CSSProperties}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setUploadFile('contractDoc', file)
                      e.target.value = ''
                    }
                  }}
                />
                {renderPreview('contractDoc')}
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
                <div className="space-y-2">
                  <Label htmlFor="visa-notice">A copy of your visa grant notice (Image)</Label>
                  <input
                    id="visa-notice"
                    ref={(el) => { fileInputRefs.current['visaNotice'] = el }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' } as React.CSSProperties}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setUploadFile('visaNotice', file)
                        e.target.value = ''
                      }
                    }}
                  />
                  {renderPreview('visaNotice')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emergency Contact */}
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
              <Input id="emergency-phone" {...form.register('emergency.phone')} />
              {form.formState.errors.emergency?.phone && <p className="text-sm text-destructive">{form.formState.errors.emergency.phone.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Declaration and Consent */}
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

        <CardFooter className="flex justify-start">
          <Button type="submit" disabled={loading || !form.formState.isValid}>
            {loading ? 'Saving...' : 'Save Profile'}
          </Button>
        </CardFooter>
      </form>
    </div>
  )
}

export default Profile