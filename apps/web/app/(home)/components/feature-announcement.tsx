'use client'

import {Announcement, AnnouncementTitle} from "@/components/ui/announcement";
import {ArrowUpRightIcon} from "@phosphor-icons/react";
import {cn} from "@/lib/utils";
import Link from "next/link";

const FeatureAnnouncement = ({content, href, className}: {content: string, href: string, className?: string}) => {
	return (
		<Link href={href}>
			<Announcement className={cn('bg-background/40 pl-1.5 group', className)}>
				<AnnouncementTitle>
					<span className="py-1.5 px-2.5 mr-1 rounded-full bg-neutral-950 text-[10px]">NEW</span>
					{content}
					<ArrowUpRightIcon size={16} className="shrink-0 text-muted-foreground group-hover:translate-y-[-2px] transition" />
				</AnnouncementTitle>
			</Announcement>
		</Link>
	)
}

export default FeatureAnnouncement
