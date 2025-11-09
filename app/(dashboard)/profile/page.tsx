'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to load profile')
      }
      const data = await response.json()
      setProfile(data.profile)
      setName(data.profile.name || '')
      setBio(data.profile.bio || '')
    } catch (error) {
      console.error('Error loading profile:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bio }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const data = await response.json()
      setProfile(data.profile)
      setEditing(false)
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'File must be an image' })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' })
      return
    }

    setUploadingAvatar(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload avatar')
      }

      const data = await response.json()
      setProfile(data.profile)
      setMessage({ type: 'success', text: 'Avatar uploaded successfully!' })
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to upload avatar' })
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-2xl font-bold text-gray-900 hover:text-blue-600"
              >
                ProductOS
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-lg font-semibold text-gray-700">Profile</span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Edit Profile
            </button>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 rounded-md p-4 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{message.text}</p>
              <button
                onClick={() => setMessage(null)}
                className="text-sm font-semibold hover:opacity-75"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow-sm">
          {editing ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar
                </label>
                <div className="flex items-center space-x-4">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-semibold text-gray-500">
                        {profile.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {uploadingAvatar ? 'Uploading...' : 'Upload a new avatar (max 5MB)'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm px-3 py-2 border text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email cannot be changed
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setName(profile.name || '')
                    setBio(profile.bio || '')
                  }}
                  className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-2xl font-semibold text-gray-500">
                      {profile.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {profile.name || 'No name set'}
                  </h2>
                  <p className="text-sm text-gray-600">{profile.email}</p>
                </div>
              </div>

              {profile.bio && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Bio</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700">Member since</p>
                <p className="text-sm text-gray-600">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

