import React from 'react'
import Link from 'next/link'

export default function page() {
  return (
    <div className='flex flex-col'>
        <Link href={"/dashboard/memory"}>Memorize</Link>
        <Link href={"/dashboard/practice"}>Practice Problems</Link>
    </div>
  )
}
