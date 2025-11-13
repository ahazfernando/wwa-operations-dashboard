"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const Reset = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            toast({
                title: 'Invalid Email',
                description: 'Please enter a valid email address.',
                variant: 'destructive',
            });
            return;
        }

        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, trimmedEmail);
            toast({
                title: 'Password Reset Requested',
                description: "If an account with this email exists, we've sent a password reset link. Check your spam folder if needed.",
            });
            router.push('/login');
        } catch (error: unknown) {
            // Handle specific Firebase errors
            let message = 'An unknown error occurred';
            if (error instanceof Error) {
                if (error.message.includes('auth/invalid-email')) {
                    message = 'Please enter a valid email address.';
                } else if (error.message.includes('auth/user-not-found')) {
                    // Rare: Firebase usually masks this, but handle if it surfaces
                    message = 'No account found with this email.';
                } else {
                    message = error.message;
                }
            }
            toast({
                title: 'Request Failed',
                description: message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white dark:bg-black">
            <ThemeToggle />
            <div className="hidden lg:flex lg:w-1/2 relative bg-white dark:bg-black">
                <div className="absolute top-4 left-4 bottom-4 right-0">
                    <Image
                        src="/auth/2e64f549b1f72ba5af0b68ef78446f0d.jpg"
                        alt="Auth background"
                        fill
                        className="object-cover rounded-[40px]"
                        priority
                    />
                </div>
                <div className="relative z-10 flex flex-col items-center justify-end pb-24 w-full h-full">
                    <div className="text-center text-white">
                        <div className="mb-6">
                            <Image
                                src="/companylogo/WWA - White (1).png"
                                alt="We Will Australia Logo"
                                width={160}
                                height={180}
                                className="mx-auto"
                                priority
                            />
                        </div>
                        <h2 className="text-2xl font-semibold mb-2">Automation for Growth of Australia</h2>
                        <p className="text-white/80 text-md max-w-md mx-auto">Streamlining Time, Performance, and Lead Management to improve efficiency and productivity</p>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-white dark:bg-black">
                <div className="w-full max-w-md">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2">Forget Password</h1>
                        <p className="text-muted-foreground">Enter your email to reset your password.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="eg. johnfrans@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Reset;