import {useEffect,useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {auth} from '../services/firebase';
export function useSession(){
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(!!auth);
 useEffect(()=>{if(!auth)return; return onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)})},[]);
 return {user,loading};
}
