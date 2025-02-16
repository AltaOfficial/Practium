import React from 'react'
import Link from 'next/link'

export default function Navbar() {
  return (
    <div className='flex justify-between px-10 py-10'>
        <div>Logo</div>

        <div className='flex gap-2'>
            <Link href={""}>Explore</Link>
            <Link href={""}>Features</Link>
            <Link href={""}>FAQ</Link>
        </div>

        <div className='flex gap-4'>
            <Link href={"/dashboard"}>Login</Link>
            <button className=''>Get Started</button>
        </div>
    </div>
  )
}
